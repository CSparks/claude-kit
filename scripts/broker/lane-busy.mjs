// lane-busy.mjs — is any lane of the checkout doing real work? Every lane builds into one shared
// CARGO_TARGET_DIR, so idle work (deferred re-checks) yields to a queued or running job in any lane.
//
// `laneBusy(cfg)` → a one-line reason, or null when every lane is idle. The caller's own lane counts
// its queue only (its own journal is the idle work itself); another lane's journal counts unless it
// is that lane's own idle work.

import { brokerPaths, laneConfigs } from './config.mjs';
import { readInflight } from './preimage.mjs';
import { listQueue } from './result.mjs';

const IDLE_WORK = /^(deferred|suite-)/;

export function laneBusy(cfg) {
  for (const lane of laneConfigs(cfg)) {
    const name = lane.lane || 'root';
    if (listQueue(lane).length) return `lane ${name} has a queued job`;
    if ((lane.lane || null) === (cfg.lane || null)) continue;
    const inflight = readInflight(lane);
    if (inflight && !IDLE_WORK.test(String(inflight.id))) return `lane ${name} is running ${inflight.id} (${brokerPaths(lane).home})`;
  }
  return null;
}
