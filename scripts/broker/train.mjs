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
// A command the daemon aborted ends the build without blame: a timeout fails the whole group, an operator
// cancel fails the named member and the rest rebuild without it (KIT-T676).
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
import { prepareCheckTree } from './check-tree.mjs';
import { clearLive, markLive, withLive } from './live-patch.mjs';

function baseFields(job, startedAt) {
  return {
    id: job.id, revises: job.revises || null, revision: job.revision || 1, repo: job.repo, ticket: job.ticket || null,
    title: job.title || null, base: job.base || null, startedAt, land: !!job.land,
    gate: [], stale: [], commands: [], foreign: [], diffStat: '', landed: null, message: null,
  };
}

export function runTrain(cfg, repo, members, { onResult = () => {} } = {}) {
  const id = `train-${members[0].job.id}`;
  const size = members.length;
  const ph = phaseTracker(cfg, id);
  const startedAt = new Date().toISOString();
  const live = members[0].cwd;
  let cwd = live;
  let runCfg = cfg;
  const checkTree = cfg.checkTree && !members[0].job.pins?.length;
  const enterCheck = () => {
    const t = checkTree ? prepareCheckTree(cfg, repo) : { error: 'off' };
    if (t.error && checkTree) console.error(`broker: check tree unavailable for ${repo.name} (${t.error}); ${id} runs in the live checkout`);
    cwd = t.error ? live : t.cwd;
    runCfg = t.error ? cfg : t.cfg;
  };
  enterCheck();
  if (cwd === live) markLive(cfg, id, 'train runs in the live checkout');
  const results = [];
  let builds = 0;
  const finish = (m, fields) => {
    const train = { id, members: members.map((x) => x.job.id), size, builds };
    const r = writeResult(cfg, { ...baseFields(m.job, startedAt), head: revParse(live, 'HEAD'), ...fields, train, timings: ph.snapshot() });
    removeJob(cfg, m.job.id);
    onResult(r);
    results.push(r);
  };

  const held = implicitPins(runCfg, repo, cwd, members[0].job);
  if (held.error) {
    for (const m of members) finish(m, { status: STATUS.FAILED, phase: 'pin', message: held.error });
    clearLive(cfg);
    ph.end();
    return { results, builds };
  }
  let pins = held.pins;
  const groups = [members.slice()];
  let logN = 0;
  const nextLog = () => logN++;
  let journal = null;
  const dirtyBefore = dirtyPaths(live);
  let locksBefore = [];
  let kept = false;
  const putBack = () => { restore(cfg, journal); dropNewLocks(cwd, locksBefore); };
  try {
    checkoutPins(pins);
    while (groups.length) {
      const pool = groups.shift().filter((m) => !hasFinalResult(cfg, m.job.id));
      if (!pool.length) continue;
      const waiting = [pool, ...groups].flat();
      if (checkTree) enterCheck();
      locksBefore = lockFilesDeep(cwd);
      const paths = [...new Set([...waiting.flatMap(filesOf), ...locksBefore])];
      const snap = () => capture(cfg, { id, cwd, paths, members: waiting.map((m) => m.job.id), startedAt });
      const pre = { tree: treeState(runCfg, cwd), dirty: dirtyPaths(cwd), head: revParse(cwd, 'HEAD') };
      journal = snap();
      kept = false;
      const writePool = () => { for (const m of pool) writePlan(cwd, m.plan.files); };
      writePool();
      const { commands, perMember } = trainCommands(runCfg, cwd, pool);
      const own = (m) => perMember.get(m.job.id);
      const baseline = makeBaseline({ cfg: runCfg, job: { id, repo: repo.name }, cwd, pre, held: pins, enter: putBack, leave: () => { putBack(); journal = snap(); writePool(); } });
      ph.enter('run');
      builds++;
      const knownRed = (entry) => foreignBuild({
        cfg: runCfg, cwd, entry, touched: pool.flatMap((m) => m.touched), tree: pre.tree, head: pre.head,
        runBase: (cmd) => { const b = baseline((run) => ({ log: run(cmd, `${nextLog()}-red`) })); return b && b.log; },
        runAgain: (cmd) => runDiagnosed(runCfg, cmd, cwd, logPathFor(cfg, id, `${nextLog()}-rerun`)),
      });
      const run = runTrainCommands(runCfg, { id, repo: repo.name, cwd, commands, nextLog, baseline, knownRed });
      const foreign = foreignOf(run.entries);
      const ranFor = (m) => ({ commands: run.entries, foreign, diffStat: git(['diff', '--stat', '--', ...filesOf(m)], cwd).out, selection: own(m).selection });

      if (!run.failing) {
        const landers = pool.filter((m) => m.job.land);
        const stats = new Map(pool.map((m) => [m.job.id, ranFor(m)]));
        const land = () => landGroup(cfg, repo, { id, cwd, pool, journal, entries: run.entries, foreign, own, ranFor: (m) => stats.get(m.job.id), nextLog, finish, onPhase: (p) => ph.enter(p) });
        const settle = (out) => {
          kept = out.kept;
          if (kept) discard(cfg);
          else putBack();
          return out;
        };
        const landed = cwd === live || !landers.length ? settle(land()) : withLive(cfg, id, 'train landing', () => {
          putBack();
          revertPins(pins);
          cwd = live;
          runCfg = cfg;
          const livePins = implicitPins(cfg, repo, live, members[0].job);
          if (livePins.error) throw new Error(livePins.error);
          pins = livePins.pins;
          checkoutPins(pins);
          locksBefore = lockFilesDeep(live);
          journal = capture(cfg, { id, cwd: live, paths: [...new Set([...landers.flatMap(filesOf), ...locksBefore])], members: landers.map((m) => m.job.id), startedAt });
          for (const m of landers) writePlan(live, m.plan.files);
          return settle(land());
        });
        groups.unshift(...landed.regroup);
        continue;
      }
      if (run.failing.aborted) {
        const { kind, ids, message } = run.failing.aborted;
        const hit = kind === 'cancel' ? pool.filter((m) => ids.includes(m.job.id)) : pool;
        for (const m of hit) finish(m, { status: kind === 'cancel' ? STATUS.CANCELLED : STATUS.FAILED, phase: 'run', ...ranFor(m), message: `${message} (${id})` });
        const rest = pool.filter((m) => !hit.includes(m));
        if (rest.length) groups.unshift(rest);
        putBack();
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
    sweepOwnWrites(cfg, { id, cwd: live, before: dirtyBefore });
    ph.end();
    clearLive(cfg);
    if (journal) recordRun(cfg, { id, repo: repo.name, kind: 'train', startedAt, entries: journal.entries });
  }
  return { results, builds };
}
