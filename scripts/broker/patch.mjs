// patch.mjs — run one patch job on the live checkout (KIT-T276): re-dry-run against current
// HEAD (content-addressed), journal the pre-images, write the files, run the commands, then
// restore the tree byte for byte (check-only) or, for a green `land` job, commit by paths and
// push. Returns { result, pause }; pause leaves the job queued.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dryRun } from './apply.mjs';
import { capture, discard, dropNewLocks, pruneEmptyDirs, restore, restoreMismatches } from './preimage.mjs';
import { landPatch } from './land.mjs';
import { diagnose } from './diagnose.mjs';
import { attribute } from './attribute.mjs';
import { pairedPins, suspects } from './paired.mjs';
import { addDeferred } from './deferred.mjs';
import { GATE_CRASH, gatePlan } from './gate.mjs';
import { recordFault, recordRun } from './health-store.mjs';
import { changedLocks, checkoutState, dirtyPaths, git, lockFiles, logSince, revParse, showFile } from './git.mjs';
import { STATUS, logPathFor, writeResult } from './result.mjs';
import { runCommand } from './run.mjs';

export function staleEntries(cwd, base, stale) {
  return stale.map((s) => ({ ...s, since: base ? logSince(cwd, base, s.path) : [] }));
}

// Writes the plan's files; a deleted file's directories are pruned up to the first non-empty parent.
function writePlan(cwd, files) {
  for (const [path, f] of files) {
    const abs = join(cwd, path);
    if (f.text === null) { rmSync(abs, { force: true }); pruneEmptyDirs(dirname(abs), cwd); }
    else { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, f.text); }
  }
}

// Run the job's commands in order. A failed command with named failed tests is attributed
// (attribute.mjs) against the pre-patch tree via `hooks.baseline(fn)`; all-foreign failures
// let the job carry on, any caused failure or unattributable one stops it. A paired pin for
// the job's ticket (paired.mjs) makes every failure suspect: no baseline, the job fails.
function runCommands(cfg, job, cwd, hooks) {
  const commands = Array.isArray(job.commands) && job.commands.length ? job.commands : cfg.verifyDefault;
  const out = [];
  for (let n = 0; n < commands.length; n++) {
    const log = logPathFor(cfg, job.id, n);
    const r = runCommand(commands[n], { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs });
    const entry = { ...r, log, ...diagnose(readFileSync(log, 'utf8')) };
    out.push(entry);
    if (r.exit === 0) continue;
    if (!entry.failedTests.length || Object.keys(entry.errors).length) break;
    const pins = pairedPins(cwd, job.base, job.ticket);
    if (pins.length) { entry.suspect = suspects(entry.failed, pins); break; }
    const attributed = hooks.baseline((run) => attribute({ command: entry, runBaseline: (cmd) => run(cmd, `${n}-base`) }));
    if (!attributed || attributed.caused.length) break;
    entry.foreign = attributed.foreign;
    addDeferred(cfg, attributed.foreign.map((f) => ({ ...f, cmd: entry.cmd, repo: job.repo, job: job.id, dirty: attributed.dirty, head: attributed.head })));
  }
  return out;
}

const withState = (state, attributed) => (attributed ? { ...attributed, ...state } : attributed);
const isGreen = (commands) => commands.every((c) => c.exit === 0 || (c.foreign && c.foreign.length));
const foreignOf = (commands) => commands.flatMap((c) => c.foreign || []);

export function processPatch(cfg, job, repo) {
  const cwd = join(cfg.root, repo.path);
  const base = {
    id: job.id, revises: job.revises || null, revision: job.revision || 1, repo: job.repo, ticket: job.ticket || null,
    base: job.base || null, startedAt: new Date().toISOString(), land: !!job.land,
    gate: [], stale: [], commands: [], foreign: [], diffStat: '', landed: null, message: null,
  };
  const done = (fields) => ({ result: writeResult(cfg, { ...base, head: revParse(cwd, 'HEAD'), ...fields }) });

  const touched = (job.ops || []).map((o) => String(o.path).replace(/[\\]/g, '/'));
  const state = checkoutState(cwd, { untrackedBlocks: cfg.untrackedBlocks, dirtyBlocks: cfg.dirtyBlocks, touched });
  if (!state.clean) {
    return { ...done({ status: STATUS.DIRTY, phase: 'apply', dirtyEntries: state.entries, message: `build checkout dirty (${cwd}) — queue paused until clean` }), pause: true };
  }

  const plan = dryRun(job.ops, (p) => showFile(cwd, 'HEAD', p), { onDisk: (p) => existsSync(join(cwd, p)) });
  if (!plan.ok) return done({ status: STATUS.STALE, phase: 'apply', stale: staleEntries(cwd, job.base, plan.stale) });

  const gate = gatePlan(cwd, plan.files);
  const crash = gate.find((g) => g.check === GATE_CRASH);
  if (crash) {
    recordFault(cfg, { kind: GATE_CRASH, id: job.id, detail: crash.msg });
    return done({ status: STATUS.FAILED, phase: 'gate', gate, message: `the gate crashed (the broker's fault, not the patch's): ${crash.msg}` });
  }
  if (gate.length) return done({ status: STATUS.GATE, phase: 'gate', gate });

  if (job.land && !job.ticket) return done({ status: STATUS.FAILED, phase: 'land', message: 'a landing patch needs --ticket (the commit cites it)' });

  const locksBefore = lockFiles(cwd);
  const captureTree = () => capture(cfg, { id: job.id, cwd, paths: [...new Set([...plan.files.keys(), ...locksBefore])] });
  const startedAt = new Date().toISOString();
  let journal = captureTree();
  const restoreTree = () => {
    restore(cfg, journal);
    dropNewLocks(cwd, locksBefore);
  };
  let keep = false;
  try {
    writePlan(cwd, plan.files);
    const diffStat = git(['diff', '--stat'], cwd).out;
    const baseline = (fn) => {
      restoreTree();
      const state = { dirty: dirtyPaths(cwd), head: revParse(cwd, 'HEAD') };
      try { return withState(state, fn((cmd, tag) => { const log = logPathFor(cfg, job.id, tag); runCommand(cmd, { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs }); return log; })); }
      finally { restoreTree(); journal = captureTree(); writePlan(cwd, plan.files); }
    };
    const commands = runCommands(cfg, job, cwd, { baseline });
    const green = isGreen(commands);
    const foreign = foreignOf(commands);
    if (!green || !job.land) return done({ status: green ? STATUS.PASSED : STATUS.FAILED, phase: 'run', commands, diffStat, foreign });

    // Every Cargo.lock was journalled as found (KIT-T306), so a lock that differs from HEAD now
    // is either the maintainer's cargo-resolved lock or the run's; both belong in the landing.
    const land = landPatch(cfg, repo, job, cwd, [...new Set([...plan.files.keys(), ...changedLocks(cwd)])]);
    keep = land.committed;
    if (!land.ok) return done({ status: STATUS.FAILED, phase: 'land', commands, diffStat, foreign, message: land.error });
    return done({ status: STATUS.LANDED, phase: 'land', commands, diffStat, foreign, landed: { sha: land.sha, superSha: land.superSha } });
  } finally {
    if (keep) discard(cfg);
    else {
      restoreTree();
      const off = restoreMismatches(journal);
      if (off.length) recordFault(cfg, { kind: 'restore-mismatch', id: job.id, detail: `after the restore ${off.join(', ')} differ(s) from the journal` });
    }
    recordRun(cfg, { id: job.id, repo: job.repo, kind: 'job', startedAt, entries: journal.entries });
  }
}
