// build-env.mjs — fit a command and its environment to the cores a build holds (KIT-D135).
//
//   HELD_ENV                       set in a child's environment: this process tree already holds cores, so nested build tools pass through
//   cappedEnv(env, cores)          { CARGO_BUILD_JOBS, RUST_TEST_THREADS, NEXTEST_TEST_THREADS } each cut to `cores`
//   heldEnv(env, cores)            HELD_ENV plus cappedEnv
//   requestedCores(composed, jobs) the cores a composed command string asks for: its largest -j, else `jobs`
//   fitCommand(composed, cores)    the command string with every -j above `cores` cut to it

import { clampJobs, requestedJobs } from './jobs-flags.mjs';

export const HELD_ENV = 'CLAUDE_KIT_BUILD_HELD';
const THREAD_ENV = ['CARGO_BUILD_JOBS', 'RUST_TEST_THREADS', 'NEXTEST_TEST_THREADS'];

export const cappedEnv = (env, cores) => Object.fromEntries(THREAD_ENV.map((k) => [k, String(Math.min(Number(env[k]) || cores, cores))]));

export const heldEnv = (env, cores) => ({ [HELD_ENV]: String(process.pid), ...cappedEnv(env, cores) });

export const requestedCores = (composed, jobs) => requestedJobs(String(composed).split(/\s+/)) ?? jobs;

export const fitCommand = (composed, cores) => (cores ? clampJobs(String(composed).split(/\s+/), cores).join(' ') : composed);
