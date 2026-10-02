// queue.mjs — the strictly-serial job engine. `processOnce` drains the queue one patch at a
// time, in submission order. It pauses (stops draining, leaves the job queued) while the live
// checkout holds a hand-driven writer's changes (patch.mjs decides); a job leaves the queue
// only after its result is written, so a crash mid-job re-queues it on the next start.

import { repoByName } from './config.mjs';
import { processPatch } from './patch.mjs';
import { STATUS, listQueue, removeJob, writeResult } from './result.mjs';

// Drain the queue until it is empty or a dirty checkout pauses it. Returns a summary the daemon
// (or a test) can log. `onResult` is an optional per-job callback.
export function processOnce(cfg, { onResult } = {}) {
  const processed = [];
  for (const job of listQueue(cfg)) {
    const { result, pause } = processJob(cfg, job);
    if (onResult) onResult(result);
    if (pause) return { processed, paused: true, pausedOn: job.id, reason: 'dirty' };
    removeJob(cfg, job.id);
    processed.push(result);
  }
  return { processed, paused: false };
}

// Run one job to a written result. Returns { result, pause } — pause:true leaves the job queued.
export function processJob(cfg, job) {
  const repo = repoByName(cfg, job.repo);
  if (!repo) {
    return { result: writeResult(cfg, { id: job.id, repo: job.repo, status: STATUS.FAILED, phase: 'apply', commands: [], message: `unknown repo '${job.repo}'` }) };
  }
  return processPatch(cfg, job, repo);
}
