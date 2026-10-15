// lanes.mjs — find the per-repo queue (lane) a job lives in (KIT-D096). A submit writes a job into
// its repo's lane; wait and cancel only know the id, so they look through every lane of the checkout.
//
// `laneCfgFor(cfg, id)` → the lane config whose queue or results hold `id`, else `cfg` unchanged.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';

export function laneCfgFor(cfg, id) {
  for (const lane of laneConfigs(cfg)) {
    const p = brokerPaths(lane);
    if (existsSync(join(p.queue, `${id}.json`)) || existsSync(join(p.results, `${id}.json`))) return lane;
  }
  return cfg;
}
