// queue.mjs — the job engine. `processOnce` drains the queue session by session in turn, each
// session's jobs in submission order (rr.mjs), one build
// at a time; the head job takes along later disjoint jobs of its repo as a train (train-form.mjs,
// train.mjs), else it runs alone (patch.mjs). A repo whose live checkout holds a hand-driven writer's changes
// (patch.mjs decides) is held: its jobs stay queued while other repos' jobs run; a job leaves the queue
// only after its result is written, so a crash mid-job re-queues it on the next start; a thrown
// broker error fails the job it hit (contain.mjs) and the daemon carries on.

import { repoByName, withLane } from './config.mjs';
import { dirtyHold, holdDirty, pausedOnDirt } from './dirty.mjs';
import { rekeyHold } from './hand-hold.mjs';
import { isPaused } from './control.mjs';
import { recheckDeferred } from './deferred.mjs';
import { processPatch } from './patch.mjs';
import { reportRedPin } from './autopin.mjs';
import { dropSuperseded } from './autopin-supersede.mjs';
import { runSuite } from './suite.mjs';
import { STATUS, hasFinalResult, listQueue, queued, removeJob, writeResult } from './result.mjs';
import { formTrain } from './train-form.mjs';
import { runTrain } from './train.mjs';
import { takeOverJournal } from './takeover.mjs';
import { failOnError } from './contain.mjs';
import { lastServed, markServed, roundRobin } from './rr.mjs';
import { pruneIncremental, pruneLine } from './incremental.mjs';
import { idleSubtrees, subtreesFor, takeSubtrees } from './subtree.mjs';

// After a suite run nothing is building: drop incremental caches past `incremental_keep_hours`.
function pruneAfterSuite(cfg) {
  if (cfg.incrementalKeepHours === null) return null;
  try { return pruneLine(pruneIncremental(cfg.targetDir, { keepHours: cfg.incrementalKeepHours })); } catch (e) { return `incremental prune failed: ${e.message}`; }
}

const COALESCE_CAP = 5;

// A queue still being written to is not drained yet: `coalesceMs` (the daemon passes broker.coalesce_ms) is
// the quiet the newest submit must have had, so submits seconds apart reach formTrain together. The oldest
// job never waits more than COALESCE_CAP windows. Returns the wait in ms, or 0 to start.
export function coalesceWait(queue, coalesceMs, now = Date.now()) {
  if (!(coalesceMs > 0) || !queue.length) return 0;
  const times = queue.map((j) => Date.parse(j.submittedAt)).filter(Number.isFinite);
  if (!times.length) return 0;
  const quietFor = now - Math.max(...times);
  const waited = now - Math.min(...times);
  return quietFor >= coalesceMs || waited >= coalesceMs * COALESCE_CAP ? 0 : coalesceMs - quietFor;
}

// The queue without leftovers: a job file whose result is already final (cancelled, or finished before a
// daemon stopped) is dropped, never run again and never taken into a train.
function pendingQueue(cfg) {
  return listQueue(cfg).filter((job) => {
    if (!hasFinalResult(cfg, job.id)) return true;
    removeJob(cfg, job.id);
    console.error(`broker: dropped ${job.id} from the queue, its result is final`);
    return false;
  });
}

// Drain the queue until it is empty or the operator ran `pause`. A job whose repo holds a hand-driven
// writer's changes stays queued and pauses THAT repo only: its later jobs wait behind it (order within a
// repo is kept), jobs for clean repos run. A job that needs a submodule's tree while the other lane holds it
// (subtree.mjs) waits the same way and is reported in `waiting`. Returns a summary the daemon (or a test) can log;
// `paused` is true while any repo is held. `onResult` is an optional per-job callback.
export function processOnce(cfg, { onResult, fileBug, coalesceMs = 0 } = {}) {
  const processed = [];
  if (isPaused(cfg)) return { processed, paused: true, reason: 'manual' };
  const coalesce = coalesceWait(listQueue(cfg), coalesceMs);
  if (coalesce) return { processed, paused: false, coalescing: coalesce };
  for (const d of dropSuperseded(cfg)) console.error(`broker: dropped auto-pin ${d.id}, superseded by ${d.by}`);
  const held = new Map();
  const waiting = new Map();
  const order = roundRobin(pendingQueue(cfg), lastServed(cfg));
  for (const job of order) {
    if (held.has(job.repo) || waiting.has(job.repo) || !queued(cfg, job.id)) continue; // withdrawn since the listing
    let train = null;
    let ran;
    let tree = null;
    try {
      const taken = takeOverJournal(cfg, job.id);
      if (taken && taken.busy) { waiting.set(job.repo, taken.busy); continue; }
      if (taken) console.error(`broker: restored ${taken.restored.length} path(s) that ${job.id} left half-applied under ${taken.home}`);
      const own = repoByName(cfg, job.repo);
      if (own && dirtyHold(cfg, own)) { held.set(job.repo, job.id); rekeyHold(cfg, job, own); continue; }
      train = formTrain(cfg, job, roundRobin(pendingQueue(cfg), lastServed(cfg)), { skip: (j) => held.has(j.repo) });
      tree = takeSubtrees(cfg, subtreesFor(cfg, repoByName(cfg, job.repo) || {}, train ? train.members.map((m) => m.job) : [job]), job.id);
      if (!tree.ok) { waiting.set(job.repo, tree.reason); continue; }
      markServed(cfg, job.session);
      ran = train ? runTrain(cfg, train.repo, train.members, { onResult }) : processJob(cfg, job);
    } catch (error) {
      processed.push(...failOnError(cfg, train ? train.members.map((m) => m.job.id) : [job.id], error, { onResult }));
      continue;
    } finally {
      if (tree && tree.ok) tree.release();
    }
    if (train) {
      processed.push(...ran.results);
      continue;
    }
    const { result, pause } = ran;
    if (onResult) onResult(result);
    if (pause) { held.set(job.repo, job.id); holdDirty(cfg, job, repoByName(cfg, job.repo), result.dirtyEntries || []); continue; }
    removeJob(cfg, job.id);
    try { reportRedPin(cfg, job, result, fileBug ? { fileBug } : {}); } catch { /* the report is best effort */ }
    processed.push(result);
  }
  if (held.size) return { processed, paused: true, pausedOn: [...held.values()][0], pausedRepos: [...held.keys()], reason: 'dirty' };
  if (waiting.size) return { processed, paused: false, waiting: [...waiting.values()] };
  // Idle: re-run deferred foreign failures whose trigger (HEAD move, dirty path cleaned) fired.
  const dirtyLane = idleSubtrees(cfg).find((sub) => pausedOnDirt(withLane(cfg, sub.name), sub));
  if (dirtyLane) return { processed, paused: false, deferred: null, suite: null, waiting: [`${dirtyLane.name} is paused on uncommitted changes; idle work stays off its tree`] };
  const idle = takeSubtrees(cfg, idleSubtrees(cfg), 'idle', { idle: true });
  if (!idle.ok) return { processed, paused: false, deferred: null, suite: null, waiting: [idle.reason] };
  let deferred;
  let suite;
  try {
    deferred = recheckDeferred(cfg, fileBug ? { fileBug } : {});
    suite = deferred.cancelled ? null : runSuite(cfg, fileBug ? { fileBug } : {});
  } finally { idle.release(); }
  if (suite && !suite.cancelled && suite.status !== 'partial') suite.pruned = pruneAfterSuite(cfg);
  // Another lane's queued job also cancels idle work, but only this lane's own queue can be drained here.
  if ((deferred.cancelled || (suite && suite.cancelled)) && listQueue(cfg).length) {
    const next = processOnce(cfg, { onResult, fileBug, coalesceMs });
    return { ...next, processed: [...processed, ...next.processed] };
  }
  return { processed, paused: false, deferred, suite: suite || null };
}

// Run one job to a written result. Returns { result, pause } — pause:true leaves the job queued.
export function processJob(cfg, job) {
  const repo = repoByName(cfg, job.repo);
  if (!repo) {
    return { result: writeResult(cfg, { id: job.id, repo: job.repo, status: STATUS.FAILED, phase: 'apply', commands: [], message: `unknown repo '${job.repo}'` }) };
  }
  return processPatch(cfg, job, repo);
}
