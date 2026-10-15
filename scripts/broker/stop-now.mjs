// stop-now.mjs — `stop --now` (KIT-T525): the daemon registers a watch; a job's command run polls
// `stopNowCheck()` and, once the command's process tree is killed, `stopNowExit()` restores the
// tree from the inflight journal and exits, leaving the job queued to re-run on the next start.

let watch = null;

/** `watch` = { check(): boolean, exit(): never }. */
export const setStopNow = (w) => { watch = w; };
export const stopNowCheck = () => (watch ? watch.check() : false);
export const stopNowExit = () => { if (watch) watch.exit(); };
