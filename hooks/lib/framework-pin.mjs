// framework-pin — the report-only SessionStart step of the framework pin rule (KIT-D141, KIT-D157, KIT-T891 slice 1).
// For a project that consumes a framework submodule it fetches origin/main (bounded, throttled), reads the pin state
// with git only, and renders the delta, the may-break crates and a conflict forecast. It writes nothing to any tree:
// no checkout, merge, stash or pin; the only writes are git's fetch refs and the throttle stamp.
//
//   frameworkPinReport(root, { fetch = true }) -> string ('' when `root` consumes no framework submodule)

import { join } from 'node:path';
import { frameworksFor } from './frameworks.mjs';
import { otherConsumerPins } from './framework-pin/consumers.mjs';
import { pinDelta } from './framework-pin/delta.mjs';
import { fetchOrigin } from './framework-pin/fetch.mjs';
import { forecastConflicts } from './framework-pin/forecast.mjs';
import { renderPin } from './framework-pin/render.mjs';
import { readPinState } from './framework-pin/state.mjs';
import { brokerHolds, submodulePath } from './framework-pin/submodule.mjs';

async function reportFor(root, framework, subPath, fetch) {
  const sub = join(root, subPath);
  const fetched = fetchOrigin(sub, { skip: !fetch });
  const held = Boolean(await brokerHolds(root, framework.submodule));
  const state = readPinState(root, subPath, { held });
  const comparable = state.gitlinkKnown && state.origin;
  const delta = comparable && state.behind ? await pinDelta(root, subPath, state.gitlink, state.origin) : { subjects: [], more: 0, files: [], crates: [], mayBreak: [], wide: false };
  const forecast = held ? { overlaps: [], collisions: [], merge: 'none', mergeFiles: [] } : forecastConflicts(sub, state);
  return renderPin({ name: framework.submodule, state, delta, forecast, fetch: fetched, held, others: otherConsumerPins(root, framework) });
}

export async function frameworkPinReport(root, { fetch = true } = {}) {
  const blocks = [];
  for (const framework of frameworksFor(root)) {
    const subPath = submodulePath(root, framework);
    if (subPath) blocks.push(await reportFor(root, framework, subPath, fetch));
  }
  return blocks.join('\n');
}
