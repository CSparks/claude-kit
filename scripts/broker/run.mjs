// run.mjs — compose a job's commands with the project's parallelism rules and run each,
// streaming stdout+stderr to a per-command log file (never a pipe — the kit forbids `| head`
// on cargo, and a file is the only durable, tail-able record on Windows).
//
// USE: `composeCommand(cmd, { jobs })` → the command string a cargo command gets `-j <jobs>`
// and (for `cargo test`) `--no-fail-fast` folded in; `runCommand(cmd, opts)` → one command's
// result. Non-cargo commands (the fixture's echoes) pass through composeCommand untouched.

import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, existsSync } from 'node:fs';

const LOG_TAIL_LINES = 60;
const CARGO_BUILD_SUBS = new Set(['test', 'build', 'check', 'clippy', 'bench', 'nextest']);

// Fold `-j <jobs>` into any cargo build-shaped command (absent) and `--no-fail-fast` into
// `cargo test` (absent). Token-based so an already-present flag is never duplicated.
export function composeCommand(cmd, { jobs = 3 } = {}) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1) return String(cmd).trim();
  const sub = toks[ci + 1];
  if (!CARGO_BUILD_SUBS.has(sub)) return String(cmd).trim();
  const has = (flag) => toks.includes(flag);
  const out = toks.slice();
  if (sub === 'test' && !has('--no-fail-fast')) out.push('--no-fail-fast');
  if (!has('-j') && !has('--jobs')) out.push('-j', String(jobs));
  return out.join(' ');
}

// Run one command through the platform shell (so the fixture's `node -e`/echoes and real cargo
// both work), redirecting stdout+stderr to `logPath`. CARGO_TARGET_DIR is injected so every
// build shares the broker's one warm cache. Returns exit code, wall-clock duration, and the
// last ~60 log lines.
export function runCommand(cmd, { cwd, targetDir, logPath, jobs }) {
  const composed = composeCommand(cmd, { jobs });
  const fd = openSync(logPath, 'w');
  const started = Date.now();
  let code;
  try {
    const r = spawnSync(composed, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
      env: { ...process.env, CARGO_TARGET_DIR: targetDir },
    });
    code = r.status == null ? 1 : r.status;
  } finally {
    closeSync(fd);
  }
  return { cmd: String(cmd).trim(), composed, exit: code, durationMs: Date.now() - started, logTail: tail(logPath) };
}

export function tail(logPath, n = LOG_TAIL_LINES) {
  if (!existsSync(logPath)) return [];
  const lines = readFileSync(logPath, 'utf8').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}
