// workers.mjs — how many test files run at once (KIT-T839). Every kit test file is dominated by process spawns
// (git, node), so throughput rises with workers only until the machine's spawn rate saturates: measured on a
// 32-logical-core Windows box, the half suite took 224 s at 8 workers, 180 s at 16 and 170 s at 32, while the sum of
// per-file times grew 1.8 -> 2.9 -> 4.4 thousand seconds (each file slower under load, load flakes more likely).
// The knee is half the logical cores.
//
//   defaultWorkers(cores)  -> clamp(cores / 2, MIN_WORKERS, MAX_WORKERS)

import { availableParallelism } from 'node:os';

const MIN_WORKERS = 4;
const MAX_WORKERS = 16;

export const defaultWorkers = (cores = availableParallelism()) => Math.min(MAX_WORKERS, Math.max(MIN_WORKERS, Math.floor(cores / 2)));
