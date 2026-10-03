// current.mjs — is a result file the outcome of the job's CURRENT attempt? A job paused on a
// dirty tree keeps its earlier result file while it waits; when it runs again its id is inflight
// again, and that old result must not be reported as final (KIT-T308).

import { readInflight } from './preimage.mjs';

/** False when `result` finished before the same job id's current inflight run began. */
export function isCurrentResult(cfg, result) {
  const inflight = readInflight(cfg);
  if (!inflight || inflight.id !== result.id) return true;
  return Date.parse(result.finishedAt) >= Date.parse(inflight.startedAt);
}
