// build-grant.mjs — how many cores of the machine budget one build may take (KIT-D135). Pure.
//
//   grantFor({ requested, elastic, budget, held, commitFreeBytes?, now? }) -> cores granted, 0 = wait
//     requested  cores the build asked for (clamped into 1..budget)
//     elastic    true: starts with whatever is free once MIN_ELASTIC_GRANT cores are; false: only with all it asked for
//     held       [{ jobs, ts }] every live hold on the machine
//     commitFreeBytes  free commit-limit memory; a build that is not yet visible in it (held under RAMP_MS) is charged JOB_MEM_GIB a core
// A build that finds the machine idle is always granted, so a low-memory box never starves the first build.

import { JOB_MEM_GIB } from './jobs.mjs';

export const MIN_ELASTIC_GRANT = 4;
export const RAMP_MS = 60000;
const JOB_MEM_BYTES = JOB_MEM_GIB * 2 ** 30;

export function grantFor({ requested, elastic = false, budget, held, commitFreeBytes = Infinity, now = Date.now() }) {
  const want = Math.max(1, Math.min(Math.floor(Number(requested) || budget), budget));
  const sum = (holds) => holds.reduce((n, h) => n + (Number(h.jobs) || budget), 0);
  const taken = sum(held);
  if (taken === 0) return want;
  const unseen = sum(held.filter((h) => now - Date.parse(h.ts) < RAMP_MS));
  const memJobs = Math.floor(Math.max(0, commitFreeBytes - unseen * JOB_MEM_BYTES) / JOB_MEM_BYTES);
  const room = Math.min(budget - taken, memJobs);
  const need = elastic ? Math.min(want, MIN_ELASTIC_GRANT) : want;
  return room >= need ? Math.min(want, room) : 0;
}
