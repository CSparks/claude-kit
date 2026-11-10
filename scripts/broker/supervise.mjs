// supervise.mjs — a daemon keeps a daemon behind every other lane of its checkout (KIT-T957). Submit, wait
// and status start a missing daemon, but only when one of them runs; a lane whose daemon died with jobs
// queued would otherwise wait for the next caller. The check is a directory read per lane, throttled
// to once per SUPERVISE_MS, so it adds no polling of its own.
//
//   superviseLanes(rootCfg, root, { selfLane, spawner }) -> names of the lanes it started a daemon for
//   createSupervisor({ everyMs }) -> { tick(rootCfg, root, { selfLane, spawner, now }) }; tick runs superviseLanes
//     at most once per window and returns [] in between

import { laneConfigs, withLane } from './config.mjs';
import { laneHasWork, spawnBroker, startIfDead } from './ensure.mjs';

export const SUPERVISE_MS = 30_000;

const laneName = (cfg) => cfg.lane || 'root';

export function superviseLanes(rootCfg, root, { selfLane = null, spawner = spawnBroker } = {}) {
  return laneConfigs(withLane(rootCfg, null))
    .filter((lane) => laneName(lane) !== (selfLane || 'root') && laneHasWork(lane) && startIfDead(lane, root, spawner))
    .map(laneName);
}

export function createSupervisor({ everyMs = SUPERVISE_MS } = {}) {
  let lastAt = 0;
  return {
    tick(rootCfg, root, { selfLane = null, spawner = spawnBroker, now = Date.now() } = {}) {
      if (now - lastAt < everyMs) return [];
      lastAt = now;
      return superviseLanes(rootCfg, root, { selfLane, spawner });
    },
  };
}
