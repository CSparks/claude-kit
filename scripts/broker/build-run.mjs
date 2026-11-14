#!/usr/bin/env node
// build-run.mjs — run a build tool under the machine build budget (KIT-D135). The shims in bin/build-shims
// (cargo, cargo-nextest, cargo-ndk) call it: `node build-run.mjs <tool> <args...>`.
//
// A compiling invocation takes cores from the one budget every project shares (build-slot.mjs), starting on what
// is free once a few cores are, or queues in arrival order. The tool then runs with every parallelism setting
// (-j, CARGO_BUILD_JOBS, RUST_TEST_THREADS, NEXTEST_TEST_THREADS) cut to the cores it holds, at lowered CPU priority
// (lower still while a game runs). A program `cargo run` starts is not a build: the hold ends when it starts.
// Anything that does not compile, and a tool started by a build that already holds cores (CLAUDE_KIT_BUILD_HELD),
// runs untouched. A build queued past MAX_WAIT_S exits EXIT_QUEUED with one line naming who holds the cores, from which
// root and for how long, then the readout; never waits in silence. A hold past the 5-minute ceiling is filed once as a
// kit bug (build-long-hold.mjs). A held build that reaches its test run phase has its hold shrunk to what the tests use
// (build-phase.mjs), so the cores it no longer compiles on go to the next build. The hold records the paths the build
// compiles (cargo-scope-dirs.mjs) and the agent that started it (CLAUDE_KIT_BUILD_WRITER), so another agent's write into
// them while it compiles is refused (KIT-T1114). A build takes its hold only after another writer's refused or released
// edit has had START_WAIT_S to land (write-window.mjs, KIT-T1175).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { availableParallelism, constants, setPriority } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBuildSlot } from './build-slot.mjs';
import { classify } from './build-classify.mjs';
import { describeHolder, formatSnapshot } from './build-status.mjs';
import { liveHolds, snapshot } from './build-slot-store.mjs';
import { flagLongHolds } from './build-long-hold.mjs';
import { PHASE_POLL_MS, phaseWatch } from './build-phase.mjs';
import { HELD_ENV, heldEnv } from './build-env.mjs';
import { cargoConfigJobs } from './cargo-config-jobs.mjs';
import { clampJobs, requestedJobs } from './jobs-flags.mjs';
import { compiledScope } from './cargo-scope-dirs.mjs';
import { START_WAIT_S, waitOutWindows } from './write-window.mjs';

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

const holderLine = (state) => (state.holds.length ? `${describeHolder(state.holds[0], state.budget)}\n` : '');

async function runGated(real, tool, args, verdict, cwd) {
  const requested = requestedJobs(args) ?? (Number(process.env.CARGO_BUILD_JOBS) || cargoConfigJobs(cwd) || availableParallelism());
  const maxWaitMs = (Number(process.env.CLAUDE_KIT_BUILD_MAX_WAIT_S) || DEFAULT_MAX_WAIT_S) * 1000;
  const label = `${cwd}: ${tool} ${args.join(' ')}`.slice(0, LABEL_CHARS);
  const deadline = Date.now() + maxWaitMs;
  let told = false;
  const shouldCancel = () => {
    if (!told) {
      told = true;
      const state = snapshot();
      process.stderr.write(`[build-budget] queued for ${Math.min(requested, state.budget)} cores (budget ${state.budget})\n${holderLine(state)}${formatSnapshot(state)}\n`);
    }
    return Date.now() > deadline;
  };
  const { scope, via, reason } = compiledScope(args, cwd, findReal('cargo') || 'cargo');
  const writer = process.env.CLAUDE_KIT_BUILD_WRITER || '';
  const meta = { scope, scopeVia: via, scopeReason: reason, writer };
  const beforeStart = () => waitOutWindows({ scope, writer, onWait: (w) => process.stderr.write(`[build-budget] holding the start up to ${START_WAIT_S}s: ${w.writer || 'another writer'} has an edit to ${w.file} to land first\n`) });
  const slot = acquireBuildSlot(`${tool} ${verdict.sub}`, { jobs: requested, elastic: true, force: true, label, cwd, shouldCancel, meta, beforeStart });
  await flagLongHolds(liveHolds());
  if (slot.cancelled) {
    const state = snapshot();
    process.stderr.write(`[build-budget] still queued after ${maxWaitMs / 1000}s, not started; run again when cores free up\n${holderLine(state)}${formatSnapshot(state)}\n`);
    return EXIT_QUEUED;
  }
  const cores = slot.granted;
  if (requested > cores) process.stderr.write(`[build-budget] ${tool} asked for ${requested} cores, running on ${cores}\n`);
  const env = { ...process.env, ...heldEnv(process.env, cores) };
  const child = start(real, clampJobs(args, cores), env, ['inherit', 'inherit', verdict.runs ? 'pipe' : 'inherit']);
  lowerPriority(child, snapshot().game);
  if (verdict.runs) forwardUntilProgram(child, () => slot.release());
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  const phase = phaseWatch({ slot, pid: child.pid });
  const watching = setInterval(() => phase.poll(), PHASE_POLL_MS);
  return new Promise((done) => child.on('exit', (code, signal) => { clearInterval(watching); slot.release(); done(code ?? (signal ? 1 : 0)); }));
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
