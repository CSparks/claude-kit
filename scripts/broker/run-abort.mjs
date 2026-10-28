// run-abort.mjs — why a daemon-run job command ends before it finishes on its own (KIT-T676): the
// operator cancelled the running job, or the command ran past its limit (command-limit.mjs).
// The daemon registers one watch; run.mjs asks it for each command's limit and polls it.
//
//   setAbortWatch({ cancelled(): ids|null, limitMs(cmd): number })
//   operatorCancel() -> the job ids the operator cancelled, or null
//   limitFor(cmd)    -> the command's time limit in ms, 0 for none

import { commandLimitMs } from './command-limit.mjs';
import { pendingCancel } from './cancel-running.mjs';

let watch = null;
export const setAbortWatch = (w) => { watch = w; };
export const operatorCancel = () => (watch ? watch.cancelled() : null);
export const limitFor = (cmd) => (watch ? watch.limitMs(cmd) : 0);

/** The watch a lane's daemon registers: its operator-cancel marker and its command limits. */
export const daemonAbortWatch = (cfg) => ({ cancelled: () => pendingCancel(cfg), limitMs: (cmd) => commandLimitMs(cfg, cmd) });
