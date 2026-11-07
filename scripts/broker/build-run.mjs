#!/usr/bin/env node
// build-run.mjs — run a build tool under the machine build budget (KIT-D135). The shims in bin/build-shims
// (cargo, cargo-nextest, cargo-ndk) call it: `node build-run.mjs <tool> <args...>`.
//
// A compiling invocation takes cores from the one budget every project shares (build-slot.mjs), starting on what
// is free once a few cores are, or queues in arrival order. The tool then runs with every parallelism setting
// (-j, CARGO_BUILD_JOBS, RUST_TEST_THREADS, NEXTEST_TEST_THREADS) cut to the cores it holds, at lowered CPU priority
// (lower still while a game runs). A program `cargo run` starts is not a build: the hold ends when it starts.
// Anything that does not compile, and a tool started by a build that already holds cores (CLAUDE_KIT_BUILD_HELD),
// runs untouched. A build queued past MAX_WAIT_S exits EXIT_QUEUED with the readout, never waits in silence.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { availableParallelism, constants, setPriority } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBuildSlot } from './build-slot.mjs';
import { classify } from './build-classify.mjs';
import { formatSnapshot } from './build-status.mjs';
import { snapshot } from './build-slot-store.mjs';
import { HELD_ENV, heldEnv } from './build-env.mjs';
import { cargoConfigJobs } from './cargo-config-jobs.mjs';
import { clampJobs, requestedJobs } from './jobs-flags.mjs';

const EXIT_QUEUED = 75;
const EXIT_NOT_FOUND = 127;
const DEFAULT_MAX_WAIT_S = 280;
const LABEL_CHARS = 100;
const SHIM_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'build-shims');
const PROGRAM_STARTED = /^\s*Running `/;
const WINDOWS = process.platform === 'win32';

export function findReal(tool, env = process.env, shimDir = SHIM_DIR) {
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  const skip = shimDir.toLowerCase();
  for (const dir of String(env[pathKey] || '').split(delimiter).filter(Boolean)) {
    if (resolve(dir).toLowerCase() === skip) continue;
    for (const ext of WINDOWS ? ['.exe', '.cmd', '.bat'] : ['']) {
      const file = join(dir, tool + ext);
      if (existsSync(file)) return file;
    }
  }
  return null;
}

const quoted = (a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

function start(real, args, env, stdio) {
  if (/\.(cmd|bat)$/i.test(real)) return spawn(`"${real}"`, args.map(quoted), { stdio, env, shell: true });
  return spawn(real, args, { stdio, env });
}

function lowerPriority(child, game) {
  try { setPriority(child.pid, game ? constants.priority.PRIORITY_LOW : constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* priority is a courtesy */ }
}

function forwardUntilProgram(child, release) {
  let tail = '';
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    tail = (tail + chunk).split('\n').slice(-2).join('\n');
    if (tail.split('\n').some((l) => PROGRAM_STARTED.test(l))) release();
  });
}

function runGated(real, tool, args, verdict, cwd) {
  const requested = requestedJobs(args) ?? (Number(process.env.CARGO_BUILD_JOBS) || cargoConfigJobs(cwd) || availableParallelism());
  const maxWaitMs = (Number(process.env.CLAUDE_KIT_BUILD_MAX_WAIT_S) || DEFAULT_MAX_WAIT_S) * 1000;
  const label = `${cwd}: ${tool} ${args.join(' ')}`.slice(0, LABEL_CHARS);
  const deadline = Date.now() + maxWaitMs;
  let told = false;
  const shouldCancel = () => {
    if (!told) { told = true; process.stderr.write(`[build-budget] queued for ${requested} cores\n${formatSnapshot(snapshot())}\n`); }
    return Date.now() > deadline;
  };
  const slot = acquireBuildSlot(`${tool} ${verdict.sub}`, { jobs: requested, elastic: true, force: true, label, cwd, shouldCancel });
  if (slot.cancelled) {
    process.stderr.write(`[build-budget] still queued after ${maxWaitMs / 1000}s, not started; run again when cores free up\n${formatSnapshot(snapshot())}\n`);
    return EXIT_QUEUED;
  }
  const cores = slot.granted;
  if (requested > cores) process.stderr.write(`[build-budget] ${tool} asked for ${requested} cores, running on ${cores}\n`);
  const env = { ...process.env, ...heldEnv(process.env, cores) };
  const child = start(real, clampJobs(args, cores), env, ['inherit', 'inherit', verdict.runs ? 'pipe' : 'inherit']);
  lowerPriority(child, snapshot().game);
  if (verdict.runs) forwardUntilProgram(child, () => slot.release());
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  return new Promise((done) => child.on('exit', (code, signal) => { slot.release(); done(code ?? (signal ? 1 : 0)); }));
}

async function main([tool, ...args]) {
  const real = findReal(tool);
  if (!real) { process.stderr.write(`[build-budget] ${tool}: not found on PATH\n`); return EXIT_NOT_FOUND; }
  const cwd = process.cwd();
  const verdict = process.env[HELD_ENV] ? { gated: false } : classify(tool, args, cwd);
  if (verdict.gated) return runGated(real, tool, args, verdict, cwd);
  const child = start(real, args, process.env, 'inherit');
  return new Promise((done) => child.on('exit', (code, signal) => done(code ?? (signal ? 1 : 0))));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
