// build-grant.mjs — how many cores of the machine budget one build may take (KIT-D135). Pure.
//
//   grantFor({ requested, elastic, budget, held, commitFreeBytes?, now? }) -> cores granted, 0 = wait
//     requested  cores the build asked for (clamped into 1..budget)
//     elastic    true: starts with whatever is free once MIN_ELASTIC_GRANT cores are; false: only with all it asked for
//     held       [{ jobs, ts }] every live hold on the machine; ts = when the hold began
//     commitFreeBytes  free commit-limit memory; a build that is not yet visible in it (held under RAMP_MS) is charged JOB_MEM_GIB a core
// A build that finds the machine idle is always granted, so a low-memory box never starves the first build.
// A running build cannot give cores back, so while any hold is past LONG_HOLD_MS (the KIT-D104 ceiling) the budget
// stretches by OVERFLOW_CORES: one small slice starts beside it (KIT-T1031). isLongHold(hold, now?) names such a hold.

import { JOB_MEM_GIB } from './jobs.mjs';

export const MIN_ELASTIC_GRANT = 4;
export const RAMP_MS = 60000;
export const LONG_HOLD_MS = 5 * 60000;
export const OVERFLOW_CORES = MIN_ELASTIC_GRANT;
const JOB_MEM_BYTES = JOB_MEM_GIB * 2 ** 30;

export const isLongHold = (hold, now = Date.now()) => now - Date.parse(hold.ts) >= LONG_HOLD_MS;

export function grantFor({ requested, elastic = false, budget, held, commitFreeBytes = Infinity, now = Date.now() }) {
  const want = Math.max(1, Math.min(Math.floor(Number(requested) || budget), budget));
  const sum = (holds) => holds.reduce((n, h) => n + (Number(h.jobs) || budget), 0);
  const taken = sum(held);
  if (taken === 0) return want;
  const unseen = sum(held.filter((h) => now - Date.parse(h.ts) < RAMP_MS));
  const memJobs = Math.floor(Math.max(0, commitFreeBytes - unseen * JOB_MEM_BYTES) / JOB_MEM_BYTES);
  const ceiling = budget + (held.some((h) => isLongHold(h, now)) ? OVERFLOW_CORES : 0);
  const room = Math.min(ceiling - taken, memJobs);
  const need = elastic ? Math.min(want, MIN_ELASTIC_GRANT) : want;
  return room >= need ? Math.min(want, room) : 0;
}
