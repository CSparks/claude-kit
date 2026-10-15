// queue.mjs — the job engine. `processOnce` drains the queue session by session in turn, each
// session's jobs in submission order (rr.mjs), one build
// at a time; the head job takes along later disjoint jobs of its repo as a train (train-form.mjs,
// train.mjs), else it runs alone (patch.mjs). A repo whose live checkout holds a hand-driven writer's changes
// (patch.mjs decides) is held: its jobs stay queued while other repos' jobs run; a job leaves the queue
// only after its result is written, so a crash mid-job re-queues it on the next start; a thrown
// broker error fails the job it hit (contain.mjs) and the daemon carries on.

import { repoByName } from './config.mjs';
import { isPaused } from './control.mjs';
import { recheckDeferred } from './deferred.mjs';
import { processPatch } from './patch.mjs';
import { runSuite } from './suite.mjs';
import { STATUS, listQueue, queued, removeJob, writeResult } from './result.mjs';
import { formTrain } from './train-form.mjs';
import { runTrain } from './train.mjs';
import { failOnError } from './contain.mjs';
import { lastServed, markServed, roundRobin } from './rr.mjs';
import { pruneIncremental, pruneLine } from './incremental.mjs';

// After a suite run nothing is building: drop incremental caches past `incremental_keep_hours`.
function pruneAfterSuite(cfg) {
  if (cfg.incrementalKeepHours === null) return null;
  try { return pruneLine(pruneIncremental(cfg.targetDir, { keepHours: cfg.incrementalKeepHours })); } catch (e) { return `incremental prune failed: ${e.message}`; }
}

// Drain the queue until it is empty or the operator ran `pause`. A job whose repo holds a hand-driven
// writer's changes stays queued and pauses THAT repo only: its later jobs wait behind it (order within a
// repo is kept), jobs for clean repos run. Returns a summary the daemon (or a test) can log;
// `paused` is true while any repo is held. `onResult` is an optional per-job callback.
export function processOnce(cfg, { onResult, fileBug } = {}) {
  const processed = [];
  if (isPaused(cfg)) return { processed, paused: true, reason: 'manual' };
  const held = new Map();
  const suites = [];
  const order = roundRobin(listQueue(cfg), lastServed(cfg));
  for (const job of order) {
    if (held.has(job.repo) || !queued(cfg, job.id)) continue; // withdrawn since the listing
    const overdue = runSuite(cfg, { force: true, ...(fileBug ? { fileBug } : {}) });
    if (overdue) suites.push(overdue);
    let train = null;
    let ran;
    try {
      train = formTrain(cfg, job, roundRobin(listQueue(cfg), lastServed(cfg)), { skip: (j) => held.has(j.repo) });
      markServed(cfg, job.session);
      ran = train ? runTrain(cfg, train.repo, train.members, { onResult }) : processJob(cfg, job);
    } catch (error) {
      processed.push(...failOnError(cfg, train ? train.members.map((m) => m.job.id) : [job.id], error, { onResult }));
      continue;
    }
    if (train) {
      processed.push(...ran.results);
      continue;
    }
    const { result, pause } = ran;
    if (onResult) onResult(result);
    if (pause) { held.set(job.repo, job.id); continue; }
    removeJob(cfg, job.id);
    processed.push(result);
  }
  if (held.size) return { processed, paused: true, pausedOn: [...held.values()][0], pausedRepos: [...held.keys()], reason: 'dirty' };
  // Idle: re-run deferred foreign failures whose trigger (HEAD move, dirty path cleaned) fired.
  const deferred = recheckDeferred(cfg, fileBug ? { fileBug } : {});
  const suite = deferred.cancelled ? null : runSuite(cfg, fileBug ? { fileBug } : {});
  if (suite && !suite.cancelled) suite.pruned = pruneAfterSuite(cfg);
  if (deferred.cancelled || (suite && suite.cancelled)) {
    const next = processOnce(cfg, { onResult, fileBug });
    return { ...next, processed: [...processed, ...next.processed] };
  }
  return { processed, paused: false, deferred, suite: suite || suites.at(-1) || null };
}

// Run one job to a written result. Returns { result, pause } — pause:true leaves the job queued.
export function processJob(cfg, job) {
  const repo = repoByName(cfg, job.repo);
  if (!repo) {
    return { result: writeResult(cfg, { id: job.id, repo: job.repo, status: STATUS.FAILED, phase: 'apply', commands: [], message: `unknown repo '${job.repo}'` }) };
  }
  return processPatch(cfg, job, repo);
}
