// run-abort.mjs — why a daemon-run job command ends before it finishes on its own (KIT-T676): the
// operator cancelled the running job, or the command ran past its limit (command-limit.mjs).
// The daemon registers one watch; run.mjs asks it for each command's limit and polls it.
//
//   setAbortWatch({ cancelled(): ids|null, limitMs(cmd): number, historyMs?(cmd): number })
//   operatorCancel() -> the job ids the operator cancelled, or null
//   limitFor(cmd)    -> the command's time limit in ms, 0 for none
//   historyFor(cmd)  -> the longest passing run of the command on record in ms, 0 for none

import { commandHistoryMs, commandLimitMs } from './command-limit.mjs';
import { pendingCancel } from './cancel-running.mjs';

let watch = null;
export const setAbortWatch = (w) => { watch = w; };
export const operatorCancel = () => (watch ? watch.cancelled() : null);
export const limitFor = (cmd) => (watch ? watch.limitMs(cmd) : 0);
export const historyFor = (cmd) => (watch && watch.historyMs ? watch.historyMs(cmd) : 0);

/** The watch a lane's daemon registers: its operator-cancel marker, its command limits and the history behind them. */
export const daemonAbortWatch = (cfg) => ({ cancelled: () => pendingCancel(cfg), limitMs: (cmd) => commandLimitMs(cfg, cmd), historyMs: (cmd) => commandHistoryMs(cfg, cmd) });
