// patch.mjs — run one patch job on the live checkout (KIT-T276): admit it (admit.mjs), journal
// the pre-images, write the files, run the commands, then restore the tree byte for byte
// (check-only) or, for a green `land` job, commit by paths and push. Returns { result, pause };
// pause leaves the job queued. Several disjoint jobs run together as a train (train.mjs).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { admit } from './admit.mjs';
import { capture, discard, dropNewLocks, markCommitted, markLinked, restore } from './preimage.mjs';
import { checkRestore } from './restore-check.mjs';
import { sweepOwnWrites } from './own-writes.mjs';
import { landLinked } from './linked.mjs';
import { diagnose } from './diagnose.mjs';
import { attribute } from './attribute.mjs';
import { pairedPins, suspects } from './paired.mjs';
import { addDeferred, forgetPassed } from './deferred.mjs';
import { findGreen, greenKey, recordGreen } from './green.mjs';
import { hashKey, treeState } from './cache.mjs';
import { makeBaseline } from './baseline.mjs';
import { landGate } from './landgate.mjs';
import { coalesce } from './coalesce.mjs';
import { testRecord } from './test-record.mjs';
import { phaseTracker } from './phase.mjs';
import { gateTrailer } from './trailer.mjs';
import { scopePin } from './pin-scope.mjs';
import { stalePins } from './pin-stale.mjs';
import { checkoutPins, implicitPins, preparePins, revertPins, settlePins } from './pin.mjs';
import { recordRun } from './health-store.mjs';
import { changedLocks, dirtyPaths, git, revParse } from './git.mjs';
import { lockFilesDeep, resolveLocks } from './locks.mjs';
import { STATUS, logPathFor, writeResult } from './result.mjs';
import { runCommand, runDiagnosed } from './run.mjs';
import { writePlan } from './write-plan.mjs';
import { abortOf, foreignOf, isGreen, jobCommands, landedJob } from './job-commands.mjs';
import { prebuildCommand, withPrebuild } from './prebuild.mjs';
import { foreignBuild } from './known-red.mjs';

// Run the job's commands in order. A failed command with named failed tests is attributed
// (attribute.mjs) against the pre-patch tree via `hooks.baseline(fn)`; all-foreign failures
// let the job carry on, any caused failure or unattributable one stops it. A paired pin for
// the job's ticket (paired.mjs) makes every failure suspect: no baseline, the job fails.
function runCommands(cfg, job, cwd, hooks) {
  const commands = cfg.runner === 'nextest' ? coalesce(jobCommands(cfg, job)) : jobCommands(cfg, job).map((cmd) => ({ cmd, from: null }));
  const out = [];
  for (let n = 0; n < commands.length; n++) {
    const log = logPathFor(cfg, job.id, n);
    const prep = hooks.record ? hooks.record.prepare(n, commands[n].cmd, cwd, log) : { cmd: commands[n].cmd, skipped: 0 };
    const r = runCommand(prep.cmd, { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs, testThreads: cfg.testThreads });
    const entry = { ...r, cmd: commands[n].cmd, log, ...(prep.skipped ? { resumedSkipped: prep.skipped } : {}), ...(commands[n].from ? { coalesced: commands[n].from } : {}), ...diagnose(readFileSync(log, 'utf8')) };
    out.push(entry);
    forgetPassed(cfg, job.repo, entry.passed);
    if (r.exit === 0) continue;
    if (!(job.ops || []).length) continue; // a test-only job already runs on the baseline: its failures are the baseline's
    if (Object.keys(entry.errors).length) {
      const red = hooks.knownRed ? hooks.knownRed(entry, n) : null;
      if (red) entry.knownRed = red;
      if (red && red.clean) continue;
      break;
    }
    if (!entry.failedTests.length) break;
    const pins = pairedPins(cwd, job.base, job.ticket);
    if (pins.length) { entry.suspect = suspects(entry.failed, pins); break; }
    const attributed = hooks.baseline((run) => attribute({ command: entry, runBaseline: (cmd) => run(cmd, `${n}-base`) }));
    if (!attributed || attributed.caused.length) break;
    entry.foreign = attributed.foreign;
    addDeferred(cfg, attributed.foreign.map((f) => ({ ...f, cmd: entry.cmd, repo: job.repo, job: job.id, dirty: attributed.dirty, head: attributed.head })));
  }
  return out;
}

// A landing that reuses a check-only run still compiles every target under the affected gate (KIT-T677): the
// check-only run's own commands may build only the targets they name.
function compileCheckMissing(cfg, job, cwd, reused) {
  if (cfg.landGate !== 'affected' || reused.commands.some((c) => c.cmd === cfg.affected.check)) return [];
  return runCommands(cfg, { ...job, commands: [cfg.affected.check] }, cwd, { baseline: () => null });
}

// `opts.gated` runs a landing's gate without landing (the check-tree run of a landing, check-run.mjs); `opts.write` replaces
// writeResult (that run's result stays private); `opts.keyTree()` is the tree state the green key is taken over (the live checkout's).
export function processPatch(cfg, job, repo, opts = {}) {
  const base = {
    id: job.id, revises: job.revises || null, revision: job.revision || 1, repo: job.repo, ticket: job.ticket || null,
    base: job.base || null, startedAt: new Date().toISOString(), land: !!job.land,
    gate: [], stale: [], commands: [], foreign: [], diffStat: '', landed: null, message: null,
  };
  const ph = phaseTracker(cfg, job.id);
  const cwd = join(cfg.root, repo.path);
  const writeOut = opts.write || writeResult;
  const done = (fields) => ({ result: writeOut(cfg, { ...base, head: revParse(cwd, 'HEAD'), ...fields, timings: ph.timings() }) });
  const admitted = admit(cfg, job, repo, { onPhase: (p) => ph.enter(p) });
  if (admitted.pause) ph.enter('held');
  if (!admitted.ok) return { ...done(admitted.fields), pause: admitted.pause };
  const { plan } = admitted;

  let pins = [];
  if ((job.pins || []).length) {
    const prep = preparePins(cfg, cwd, job);
    if (prep.error) return done({ status: prep.stale ? STATUS.STALE : STATUS.FAILED, phase: 'pin', message: prep.error });
    pins = prep.pins;
  }
  const held = implicitPins(cfg, repo, cwd, job);
  if (held.error) return done({ status: STATUS.FAILED, phase: 'pin', message: held.error });
  pins = [...pins, ...held.pins];
  const explicit = () => pins.filter((p) => !p.implicit);

  const pre = { tree: treeState(cfg, cwd), dirty: dirtyPaths(cwd), head: revParse(cwd, 'HEAD') };
  const key = greenKey({ repo: job.repo, pre: opts.keyTree ? opts.keyTree() : pre.tree, files: plan.files, commands: jobCommands(cfg, job), pins });
  const gateRun = job.land || opts.gated;
  const reused = gateRun ? findGreen(cfg, key) : null;
  const locksBefore = lockFilesDeep(cwd);
  const captureTree = () => capture(cfg, { id: job.id, cwd, paths: [...new Set([...plan.files.keys(), ...locksBefore])] });
  const startedAt = new Date().toISOString();
  let journal = captureTree();
  const restoreTree = () => {
    restore(cfg, journal);
    dropNewLocks(cwd, locksBefore);
  };
  let keep = false;
  let record = null;
  try {
    checkoutPins(pins);
    writePlan(cwd, plan.files);
    const diffStat = git(['diff', '--stat'], cwd).out;
    const baseline = makeBaseline({
      cfg, job, cwd, pre, held: pins.filter((p) => p.implicit),
      enter: () => { restoreTree(); revertPins(explicit()); },
      leave: () => { restoreTree(); journal = captureTree(); checkoutPins(pins); writePlan(cwd, plan.files); },
    });
    // A patch job with no commands takes the affected gate too, never the full verify_default.
    const wantsGate = gateRun || ((job.ops || []).length && !(job.commands || []).length);
    const gated = wantsGate && !reused ? landGate(cfg, cwd, job, plan.files) : null;
    const prebuild = gateRun && !reused ? prebuildCommand(repo, cwd, plan.files) : null;
    const scoped = job.autoPin && !gated && !reused ? scopePin(cfg, cwd, jobCommands(cfg, job), pins.filter((p) => !p.implicit)) : null;
    const runJob = gated || scoped || prebuild ? { ...job, commands: withPrebuild(gated ? gated.commands : scoped ? scoped.commands : jobCommands(cfg, job), prebuild) } : job;
    const note = scoped ? scoped.note : null;
    const selection = gated ? gated.selection : null;
    ph.enter('run');
    const knownRed = (entry, n) => foreignBuild({
      cfg, cwd, entry, touched: [...plan.files.keys()], tree: pre.tree, head: pre.head,
      runBase: (cmd) => { const b = baseline((run) => ({ log: run(cmd, `${n}-red`) })); return b && b.log; },
      runAgain: (cmd) => runDiagnosed(cfg, cmd, cwd, logPathFor(cfg, job.id, `${n}-rerun`)),
    });
    record = reused ? null : testRecord(cfg, job, hashKey([key, ...jobCommands(cfg, runJob)]));
    const commands = reused ? [...reused.commands.map((c) => ({ ...c, reusedFrom: reused.job })), ...compileCheckMissing(cfg, job, cwd, reused)] : runCommands(cfg, runJob, cwd, { baseline, knownRed, record });
    const green = isGreen(commands);
    const foreign = foreignOf(commands);
    if (green && !job.land && (job.ops || []).length) recordGreen(cfg, key, { job: job.id, commands, foreign });
    const aborted = abortOf(commands);
    if (aborted) return done({ status: aborted.kind === 'cancel' ? STATUS.CANCELLED : STATUS.FAILED, phase: 'run', commands, diffStat, foreign, selection, message: aborted.message });
    if (!green || !job.land) return done({ status: green ? STATUS.PASSED : STATUS.FAILED, phase: 'run', commands, diffStat, foreign, selection, pinScope: note });

    // Every Cargo.lock was journalled as found (KIT-T306), so a lock that differs from HEAD now
    // is either the maintainer's cargo-resolved lock or the run's; both belong in the landing.
    const reverify = () => {
      const again = runCommands(cfg, runJob, cwd, { baseline: () => null });
      const known = new Set(foreign.map((f) => f.test));
      return { ok: again.every((c) => c.exit === 0 || (c.failedTests.length && !Object.keys(c.errors).length && c.failedTests.every((t) => known.has(t)))) };
    };
    const stalePin = stalePins(cfg, cwd, explicit());
    if (stalePin) return done({ status: STATUS.STALE, phase: 'pin', commands, diffStat, foreign, selection, message: stalePin });
    resolveLocks(cwd, [...plan.files.keys()]);
    const land = landLinked(cfg, repo, job, cwd, [...new Set([...plan.files.keys(), ...changedLocks(cwd), ...explicit().map((p) => p.path)])], {
      verify: reverify, trailer: gateTrailer(job, commands, { reused, selection, note }), onPhase: (p) => ph.enter(p),
      onCommitted: (c) => markCommitted(cfg, journal, { ...c, repo: job.repo, jobs: [landedJob(job)] }),
      onSubLanded: (l) => {
        const under = (p) => l.gitlinks.some((s) => p.startsWith(`${s}/`));
        journal = { ...journal, entries: journal.entries.filter((e) => !under(e.path)) };
        markLinked(cfg, journal, { ...l, repo: job.repo, job: landedJob(job), trailer: gateTrailer(job, commands, { reused, selection, note }) });
      },
    });
    keep = land.committed;
    const inLanded = (p) => (land.landedSubs || []).some((s) => p.startsWith(`${s}/`));
    if ((land.landedSubs || []).length) {
      journal = { ...journal, entries: journal.entries.filter((e) => !inLanded(e.path)) };
      pins = pins.filter((p) => !land.landedSubs.includes(String(p.path).split('\\').join('/')));
    }
    if (land.conflict) return done({ status: STATUS.CONFLICT, phase: 'land', commands, diffStat, foreign, conflict: land.conflict, message: land.error });
    if (!land.ok) return done({ status: STATUS.FAILED, phase: 'land', commands, diffStat, foreign, selection, message: land.error });
    return done({ status: STATUS.LANDED, phase: 'land', commands, diffStat, foreign, selection, pinScope: note, reusedFrom: reused ? reused.job : null, landed: { sha: land.sha, superSha: land.superSha, ...(land.subSha ? { subSha: land.subSha } : {}) } });
  } finally {
    if (record) record.clear();
    if (keep) { discard(cfg); settlePins(pins); }
    else {
      restoreTree();
      revertPins(pins);
      checkRestore(cfg, journal, job.id);
    }
    sweepOwnWrites(cfg, { id: job.id, cwd, before: pre.dirty });
    recordRun(cfg, { id: job.id, repo: job.repo, kind: 'job', startedAt, entries: journal.entries });
  }
}
