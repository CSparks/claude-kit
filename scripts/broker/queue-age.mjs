// queue-age.mjs — how long a lane's oldest queued job has waited. The job id carries its submit time
// (`j-<base36 ms>-<rand>`), so no job file is opened.
//
//   oldestQueuedMs(cfg, now?) -> ms the oldest queued job has waited, or null for an empty queue
//   ageMinutes(ms)            -> whole minutes, rounded

import { listQueue } from './result.mjs';
import { submittedAt } from './stats.mjs';

const MS_PER_MIN = 60 * 1000;

export const ageMinutes = (ms) => Math.round(ms / MS_PER_MIN);

export function oldestQueuedMs(cfg, now = Date.now()) {
  const stamps = listQueue(cfg).map((j) => submittedAt(j.id)).filter(Number.isFinite);
  return stamps.length ? now - Math.min(...stamps) : null;
}
