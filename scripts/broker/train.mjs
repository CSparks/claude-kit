// train.mjs — run several disjoint, admitted patch jobs as ONE build (KIT-T482 item 1).
// A group's files are written over the live tree under one restore journal naming its members,
// the union of their commands runs once (train-commands.mjs), and:
//   green  → check-only members pass; landing members commit by their own paths in submit
//            order and go out in ONE push (train-land.mjs)
//   red    → the failure is traced to its member (train-blame.mjs); blamed members fail at once
//            and the rest rebuild without them. A red no member can be blamed for splits the
//            group in halves, first half first (bisection by subset: files come from the plans
//            in memory and the journal, never from git). Each later group runs on the HEAD the
//            earlier ones landed.
// A member leaves the queue only once its result is written; a crash re-queues the rest and the
// restart restores the tree from the journal.
//
// `runTrain(cfg, repo, members, { onResult })`: members = [{ job, cwd, plan, touched }] from
// admit.mjs, in queue order → { results, builds }.

import { makeBaseline } from './baseline.mjs';
import { treeState } from './cache.mjs';
import { dirtyPaths, git, revParse } from './git.mjs';
import { lockFilesDeep } from './locks.mjs';
import { recordRun } from './health-store.mjs';
import { foreignOf } from './job-commands.mjs';
import { phaseTracker } from './phase.mjs';
import { checkoutPins, implicitPins, revertPins } from './pin.mjs';
import { capture, discard, dropNewLocks, restore } from './preimage.mjs';
import { checkRestore } from './restore-check.mjs';
import { sweepOwnWrites } from './own-writes.mjs';
import { STATUS, hasFinalResult, logPathFor, removeJob, writeResult } from './result.mjs';
import { blame } from './train-blame.mjs';
import { trainCommands } from './train-commands.mjs';
import { landGroup } from './train-land.mjs';
import { runTrainCommands } from './train-run.mjs';
import { filesOf, writePlan } from './write-plan.mjs';
import { foreignBuild } from './known-red.mjs';
import { runDiagnosed } from './run.mjs';

function baseFields(job, startedAt) {
  return {
    id: job.id, revises: job.revises || null, revision: job.revision || 1, repo: job.repo, ticket: job.ticket || null,
    title: job.title || null, base: job.base || null, startedAt, land: !!job.land,
    gate: [], stale: [], commands: [], foreign: [], diffStat: '', landed: null, message: null,
  };
}

export function runTrain(cfg, repo, members, { onResult = () => {} } = {}) {
  const cwd = members[0].cwd;
  const id = `train-${members[0].job.id}`;
  const size = members.length;
  const ph = phaseTracker(cfg, id);
  const startedAt = new Date().toISOString();
  const results = [];
  let builds = 0;
  const finish = (m, fields) => {
    const train = { id, members: members.map((x) => x.job.id), size, builds };
    const r = writeResult(cfg, { ...baseFields(m.job, startedAt), head: revParse(cwd, 'HEAD'), ...fields, train, timings: ph.snapshot() });
    removeJob(cfg, m.job.id);
    onResult(r);
    results.push(r);
  };

  const held = implicitPins(cfg, repo, cwd, members[0].job);
  if (held.error) {
    for (const m of members) finish(m, { status: STATUS.FAILED, phase: 'pin', message: held.error });
    return { results, builds };
  }
  const pins = held.pins;
  const groups = [members.slice()];
  let logN = 0;
  const nextLog = () => logN++;
  let journal = null;
  const dirtyBefore = dirtyPaths(cwd);
  let locksBefore = [];
  let kept = false;
  const putBack = () => { restore(cfg, journal); dropNewLocks(cwd, locksBefore); };
  try {
    checkoutPins(pins);
    while (groups.length) {
      const pool = groups.shift().filter((m) => !hasFinalResult(cfg, m.job.id));
      if (!pool.length) continue;
      const waiting = [pool, ...groups].flat();
      locksBefore = lockFilesDeep(cwd);
      const paths = [...new Set([...waiting.flatMap(filesOf), ...locksBefore])];
      const snap = () => capture(cfg, { id, cwd, paths, members: waiting.map((m) => m.job.id), startedAt });
      const pre = { tree: treeState(cfg, cwd), dirty: dirtyPaths(cwd), head: revParse(cwd, 'HEAD') };
      journal = snap();
      kept = false;
      const writePool = () => { for (const m of pool) writePlan(cwd, m.plan.files); };
      writePool();
      const { commands, perMember } = trainCommands(cfg, cwd, pool);
      const own = (m) => perMember.get(m.job.id);
      const baseline = makeBaseline({ cfg, job: { id, repo: repo.name }, cwd, pre, held: pins, enter: putBack, leave: () => { putBack(); journal = snap(); writePool(); } });
      ph.enter('run');
      builds++;
      const knownRed = (entry) => foreignBuild({
        cfg, cwd, entry, touched: pool.flatMap((m) => m.touched), tree: pre.tree, head: pre.head,
        runBase: (cmd) => { const b = baseline((run) => ({ log: run(cmd, `${nextLog()}-red`) })); return b && b.log; },
        runAgain: (cmd) => runDiagnosed(cfg, cmd, cwd, logPathFor(cfg, id, `${nextLog()}-rerun`)),
      });
      const run = runTrainCommands(cfg, { id, repo: repo.name, cwd, commands, nextLog, baseline, knownRed });
      const foreign = foreignOf(run.entries);
      const ranFor = (m) => ({ commands: run.entries, foreign, diffStat: git(['diff', '--stat', '--', ...filesOf(m)], cwd).out, selection: own(m).selection });

      if (!run.failing) {
        const landed = landGroup(cfg, repo, { id, cwd, pool, journal, entries: run.entries, foreign, own, ranFor, nextLog, finish, onPhase: (p) => ph.enter(p) });
        kept = landed.kept;
        if (kept) discard(cfg);
        else putBack();
        groups.unshift(...landed.regroup);
        continue;
      }
      const verdict = blame(run.failing, pool.map((m) => ({ id: m.job.id, touched: m.touched, commands: own(m).commands })));
      const red = (m, why) => finish(m, { status: STATUS.FAILED, phase: 'run', ...ranFor(m), blame: why, message: `red in ${id} (${pool.length} of ${size} patches, build ${builds}): ${why.join('; ')}` });
      if (verdict.blamed.size) {
        for (const m of pool.filter((x) => verdict.blamed.has(x.job.id))) red(m, verdict.blamed.get(m.job.id));
        const rest = pool.filter((x) => !verdict.blamed.has(x.job.id));
        if (rest.length) groups.unshift(rest);
      } else if (pool.length === 1) {
        red(pool[0], verdict.ambiguous);
      } else {
        const half = Math.ceil(pool.length / 2);
        groups.unshift(pool.slice(0, half), pool.slice(half));
      }
      putBack();
    }
  } finally {
    if (journal && !kept) {
      putBack();
      checkRestore(cfg, journal, id);
    }
    revertPins(pins);
    sweepOwnWrites(cfg, { id, cwd, before: dirtyBefore });
    if (journal) recordRun(cfg, { id, repo: repo.name, kind: 'train', startedAt, entries: journal.entries });
  }
  return { results, builds };
}
