// run.mjs — compose a job's commands with the project's parallelism rules and run each,
// streaming stdout+stderr to a per-command log file (never a pipe — the kit forbids `| head`
// on cargo, and a file is the only durable, tail-able record on Windows).
//
// USE: `composeCommand(cmd, { jobs })` → the command string a cargo command gets `-j <jobs>`
// and (for `cargo test`) `--no-fail-fast` folded in; `runCommand(cmd, opts)` → one command's
// result. Non-cargo commands (the fixture's echoes) pass through composeCommand untouched.

import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, existsSync } from 'node:fs';
import { runCancellable } from './run-cancellable.mjs';
import { pulseActive } from './stall.mjs';
import { stopNowCheck, stopNowExit } from './stop-now.mjs';
import { diagnose } from './diagnose.mjs';
import { packageScoped } from './alias.mjs';

const LOG_TAIL_LINES = 60;
const CARGO_BUILD_SUBS = new Set(['test', 'build', 'check', 'clippy', 'bench', 'nextest', 'run', 't', 'b', 'r']);
const TEST_SUBS = new Set(['test', 't']);

const BUILD_ONLY_FLAGS = new Set(['--no-run']);
const FAIL_FAST_FLAGS = new Set(['--fail-fast', '--no-fail-fast']);
const JOBS_FLAG = /^(-j\d*|-j=\d+|--jobs(=.*)?)$/;

// Fold `-j <jobs>` into any cargo build-shaped command (absent) and `--no-fail-fast` into
// `cargo test`/`cargo t` that runs tests (absent); the `t`/`b`/`r` aliases are the project's fastdev
// builds. Token-based so a present flag, attached forms included (`-j2`, `--jobs=2`), is never
// duplicated. `--no-fail-fast` is a run-only flag: a build-only command (`--no-run`) or one that
// already chose `--fail-fast` never receives it (KIT-T616, KIT-T343).
export function composeCommand(cmd, { jobs = 3, cwd } = {}) {
  const original = String(cmd).trim().split(/\s+/);
  const wasTest = TEST_SUBS.has(original[original.indexOf('cargo') + 1]);
  const toks = packageScoped(cmd, cwd).split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1) return String(cmd).trim();
  const sub = toks[ci + 1];
  if (!CARGO_BUILD_SUBS.has(sub)) return String(cmd).trim();
  // Cargo stops reading its own flags at `--`; everything after goes to the test binary.
  const sep = toks.indexOf('--');
  const cargoToks = sep === -1 ? toks : toks.slice(0, sep);
  const rest = sep === -1 ? [] : toks.slice(sep);
  const out = cargoToks.slice();
  const runsTests = (wasTest || TEST_SUBS.has(sub)) && !cargoToks.some((t) => BUILD_ONLY_FLAGS.has(t));
  if (runsTests && !cargoToks.some((t) => FAIL_FAST_FLAGS.has(t))) out.push('--no-fail-fast');
  if (!cargoToks.some((t) => JOBS_FLAG.test(t))) out.push('-j', String(jobs));
  return out.concat(rest).join(' ');
}

// Run one command through the platform shell (so the fixture's `node -e`/echoes and real cargo
// both work), redirecting stdout+stderr to `logPath`. CARGO_TARGET_DIR is injected so every
// build shares the broker's one warm cache. Returns exit code, wall-clock duration, and the
// last ~60 log lines.
// Inside the daemon (a pulse is registered) the command runs through runCancellable, whose poll
// keeps the heartbeat fresh, so a 25-minute suite never reads as a stalled daemon (KIT-T488).
export function runCommand(cmd, { cwd, targetDir, logPath, jobs }) {
  if (pulseActive()) {
    const { cancelled, ...r } = runCancellable(cmd, { cwd, targetDir, logPath, jobs }, { shouldCancel: stopNowCheck });
    if (cancelled) stopNowExit();
    return r;
  }
  const composed = composeCommand(cmd, { jobs, cwd });
  const fd = openSync(logPath, 'w');
  const started = Date.now();
  let code;
  try {
    const r = spawnSync(composed, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', CARGO_TARGET_DIR: targetDir, ...(jobs ? { CARGO_BUILD_JOBS: String(jobs) } : {}) },
    });
    code = r.status == null ? 1 : r.status;
  } finally {
    closeSync(fd);
  }
  return { cmd: String(cmd).trim(), composed, exit: code, durationMs: Date.now() - started, logTail: tail(logPath) };
}

/** One command run to a result entry with its log diagnosis (rustc errors, failed tests). */
export function runDiagnosed(cfg, cmd, cwd, log) {
  const r = runCommand(cmd, { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs });
  return { ...r, log, ...diagnose(readFileSync(log, 'utf8')) };
}

export function tail(logPath, n = LOG_TAIL_LINES) {
  if (!existsSync(logPath)) return [];
  const lines = readFileSync(logPath, 'utf8').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}
