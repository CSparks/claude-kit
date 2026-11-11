// live-trees.mjs — the submodule trees a job takes only for its landing (KIT-T1046). With the check tree a job builds and
// tests in the broker's own copy, so the live submodule tree is needed only while a landing writes it; a lane that held
// it for the whole job idled every other lane's landings behind a build that touched none of their files. The queue
// registers the trees a job may need (`beginJob`); `withLive` (live-patch.mjs) takes them through takeSubtrees for the
// landing step and hands them over when it ends. A job that runs in the live checkout for its whole run (a pin job, or
// the check tree being unavailable) calls `holdLive` and keeps them until `endJob`.
//
//   beginJob(cfg, subs, id)   register the trees (none: nothing is ever taken); endJob() releases what is held
//   holdLive()                -> true when this call took them; false when none are registered or they are held already
//   dropLive()                release what holdLive took
//   setLandWait(ms, pollMs)   replace the wait (tests)
//   TreeBusy                  thrown when another lane holds a tree past LAND_WAIT_MS; the job stays queued

import { pulse } from './stall.mjs';
import { takeSubtrees } from './subtree.mjs';

export const LAND_WAIT_MS = 5 * 60000;
const POLL_MS = 1000;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export class TreeBusy extends Error {}

let current = null;
let wait = { landMs: Number(process.env.BROKER_LAND_WAIT_MS) || LAND_WAIT_MS, pollMs: POLL_MS };

/** Replace the bounded wait (the tests shorten it; a driver process takes it from BROKER_LAND_WAIT_MS). */
export const setLandWait = (landMs, pollMs = POLL_MS) => { wait = { landMs, pollMs }; };

export function beginJob(cfg, subs, id) {
  current = subs.length ? { cfg, subs, id, held: null } : null;
}

export function dropLive() {
  if (current && current.held) { current.held.release(); current.held = null; }
}

export const endJob = () => { dropLive(); current = null; };

export function holdLive({ waitMs = wait.landMs, pollMs = wait.pollMs } = {}) {
  if (!current || current.held) return false;
  const until = Date.now() + waitMs;
  for (;;) {
    const got = takeSubtrees(current.cfg, current.subs, current.id);
    if (got.ok) { current.held = got; return true; }
    if (Date.now() >= until) throw new TreeBusy(`${got.reason}; ${current.id} is checked and waits to land (still queued)`);
    pulse();
    sleep(pollMs);
  }
}
