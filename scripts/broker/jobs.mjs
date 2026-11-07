// jobs.mjs — the cargo `-j` the broker passes (KIT-T472). One broker is the only builder in its
// checkout, so it may use the machine's build budget (build-budget.mjs, KIT-D135): `auto` (the
// default) takes every budgeted core the memory can feed, one job per JOB_MEM_GIB of RAM (a
// Bevy-sized rustc or link peaks near that; too many jobs on Windows ends in os error 1455,
// pagefile exhausted). A number in config pins it, never above the budget.
//
// `resolveJobs(value, machine?)` → integer ≥ 1. `machine` = { cores, memBytes } for tests.

import { totalmem } from 'node:os';
import { buildCores } from './build-budget.mjs';

export const JOB_MEM_GIB = 4;
const GIB = 2 ** 30;

export function autoJobs({ cores, memBytes }) {
  return Math.max(1, Math.min(cores, Math.floor(memBytes / (JOB_MEM_GIB * GIB))));
}

export function resolveJobs(value, machine = { cores: buildCores(), memBytes: totalmem() }) {
  const n = Number(value);
  if (value != null && value !== 'auto' && Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), machine.cores);
  return autoJobs(machine);
}
