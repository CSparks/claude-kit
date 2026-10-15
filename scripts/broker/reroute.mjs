// reroute.mjs — move a job queued in the wrong lane to its repo's own queue (KIT-D096). A job
// written before lanes existed, or by a tool that ignored them, sits in the root queue with a
// submodule's repo name; the daemon hands it over so it never holds up the root lane.
//
// `rerouteMisplaced(cfg)` → ids moved. The target lane's daemon is started by the next wait/submit.

import { laneOfRepo, withLane } from './config.mjs';
import { listQueue, removeJob, writeJob } from './result.mjs';

export function rerouteMisplaced(cfg) {
  const moved = [];
  for (const job of listQueue(cfg)) {
    const lane = laneOfRepo(cfg, job.repo);
    if (lane === (cfg.lane || null)) continue;
    writeJob(withLane(cfg, lane), job);
    removeJob(cfg, job.id);
    moved.push(job.id);
  }
  return moved;
}
