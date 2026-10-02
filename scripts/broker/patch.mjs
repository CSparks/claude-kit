// patch.mjs — run one patch job on the live checkout (KIT-T276): re-dry-run against current
// HEAD (content-addressed), journal the pre-images, write the files, run the commands, then
// restore the tree byte for byte (check-only) or, for a green `land` job, commit by paths and
// push. Returns { result, pause }; pause leaves the job queued.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dryRun } from './apply.mjs';
import { capture, discard, restore } from './preimage.mjs';
import { landPatch } from './land.mjs';
import { diagnose } from './diagnose.mjs';
import { gatePlan } from './gate.mjs';
import { checkoutState, git, logSince, revParse, showFile } from './git.mjs';
import { STATUS, logPathFor, writeResult } from './result.mjs';
import { runCommand } from './run.mjs';

export function staleEntries(cwd, base, stale) {
  return stale.map((s) => ({ ...s, since: base ? logSince(cwd, base, s.path) : [] }));
}

function writePlan(cwd, files) {
  for (const [path, f] of files) {
    const abs = join(cwd, path);
    if (f.text === null) rmSync(abs, { force: true });
    else { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, f.text); }
  }
}

function runCommands(cfg, job, cwd) {
  const commands = Array.isArray(job.commands) && job.commands.length ? job.commands : cfg.verifyDefault;
  const out = [];
  for (let n = 0; n < commands.length; n++) {
    const log = logPathFor(cfg, job.id, n);
    const r = runCommand(commands[n], { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs });
    out.push({ ...r, log, ...diagnose(readFileSync(log, 'utf8')) });
    if (r.exit !== 0) break;
  }
  return out;
}

export function processPatch(cfg, job, repo) {
  const cwd = join(cfg.root, repo.path);
  const base = {
    id: job.id, revises: job.revises || null, revision: job.revision || 1, repo: job.repo, ticket: job.ticket || null,
    base: job.base || null, startedAt: new Date().toISOString(), land: !!job.land,
    gate: [], stale: [], commands: [], diffStat: '', landed: null, message: null,
  };
  const done = (fields) => ({ result: writeResult(cfg, { ...base, head: revParse(cwd, 'HEAD'), ...fields }) });

  const state = checkoutState(cwd, { untrackedBlocks: cfg.untrackedBlocks });
  if (!state.clean) {
    return { ...done({ status: STATUS.DIRTY, phase: 'apply', dirtyEntries: state.entries, message: `build checkout dirty (${cwd}) — queue paused until clean` }), pause: true };
  }

  const plan = dryRun(job.ops, (p) => showFile(cwd, 'HEAD', p), { onDisk: (p) => existsSync(join(cwd, p)) });
  if (!plan.ok) return done({ status: STATUS.STALE, phase: 'apply', stale: staleEntries(cwd, job.base, plan.stale) });

  const gate = gatePlan(cwd, plan.files);
  if (gate.length) return done({ status: STATUS.GATE, phase: 'gate', gate });

  if (job.land && !job.ticket) return done({ status: STATUS.FAILED, phase: 'land', message: 'a landing patch needs --ticket (the commit cites it)' });

  const journal = capture(cfg, { id: job.id, cwd, paths: [...plan.files.keys()] });
  let keep = false;
  try {
    writePlan(cwd, plan.files);
    const diffStat = git(['diff', '--stat'], cwd).out;
    const commands = runCommands(cfg, job, cwd);
    const green = commands.every((c) => c.exit === 0);
    if (!green || !job.land) return done({ status: green ? STATUS.PASSED : STATUS.FAILED, phase: 'run', commands, diffStat });

    const land = landPatch(cfg, repo, job, cwd, [...plan.files.keys()]);
    keep = land.committed;
    if (!land.ok) return done({ status: STATUS.FAILED, phase: 'land', commands, diffStat, message: land.error });
    return done({ status: STATUS.LANDED, phase: 'land', commands, diffStat, landed: { sha: land.sha, superSha: land.superSha } });
  } finally {
    if (keep) discard(cfg); else restore(cfg, journal);
  }
}
