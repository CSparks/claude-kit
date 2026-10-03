// queue.mjs — the strictly-serial job engine. `processOnce` drains the queue one patch at a
// time, in submission order. A repo whose live checkout holds a hand-driven writer's changes
// (patch.mjs decides) is held: its jobs stay queued while other repos' jobs run; a job leaves the queue
// only after its result is written, so a crash mid-job re-queues it on the next start.

import { repoByName } from './config.mjs';
import { isPaused } from './control.mjs';
import { recheckDeferred } from './deferred.mjs';
import { processPatch } from './patch.mjs';
import { STATUS, listQueue, removeJob, writeResult } from './result.mjs';

// Drain the queue until it is empty or the operator ran `pause`. A job whose repo holds a hand-driven
// writer's changes stays queued and pauses THAT repo only: its later jobs wait behind it (order within a
// repo is kept), jobs for clean repos run. Returns a summary the daemon (or a test) can log;
// `paused` is true while any repo is held. `onResult` is an optional per-job callback.
export function processOnce(cfg, { onResult, fileBug } = {}) {
  const processed = [];
  if (isPaused(cfg)) return { processed, paused: true, reason: 'manual' };
  const held = new Map();
  for (const job of listQueue(cfg)) {
    if (held.has(job.repo)) continue;
    const { result, pause } = processJob(cfg, job);
    if (onResult) onResult(result);
    if (pause) { held.set(job.repo, job.id); continue; }
    removeJob(cfg, job.id);
    processed.push(result);
  }
  if (held.size) return { processed, paused: true, pausedOn: [...held.values()][0], pausedRepos: [...held.keys()], reason: 'dirty' };
  // Idle: re-run deferred foreign failures whose trigger (HEAD move, dirty path cleaned) fired.
  const deferred = recheckDeferred(cfg, fileBug ? { fileBug } : {});
  return { processed, paused: false, deferred };
}

// Run one job to a written result. Returns { result, pause } — pause:true leaves the job queued.
export function processJob(cfg, job) {
  const repo = repoByName(cfg, job.repo);
  if (!repo) {
    return { result: writeResult(cfg, { id: job.id, repo: job.repo, status: STATUS.FAILED, phase: 'apply', commands: [], message: `unknown repo '${job.repo}'` }) };
  }
  return processPatch(cfg, job, repo);
}
