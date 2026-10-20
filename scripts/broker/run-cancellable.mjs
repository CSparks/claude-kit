// run-cancellable.mjs — `runCommand` that can be abandoned (KIT-T310). The command runs in a
// child process tree; the caller polls `shouldCancel()` between checks and, when it returns
// true, the whole tree is killed (taskkill /T /F on Windows, a process-group SIGKILL elsewhere).
// Synchronous like runCommand: it blocks between polls without spinning.
//
// `runCancellable(cmd, { cwd, targetDir, logPath, jobs }, { shouldCancel, pollMs })`
//   -> the runCommand result plus `cancelled: boolean`.

import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { composeCommand, tail } from './run.mjs';
import { pulse } from './stall.mjs';
import { linkFailure, recoverLink } from './link-recover.mjs';
import { killTree, trackChild, untrackChild } from './children.mjs';

const CHILD = join(import.meta.dirname, 'run-child.mjs');
const DEFAULT_POLL_MS = 500;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A link failure (link-recover.mjs) cleans the failing crate's incremental state and re-runs once;
// the log gets a trailing note and the result `recovered`.
export function runCancellable(cmd, opts, hooks) {
  const first = runOnce(cmd, opts, hooks);
  if (first.exit === 0 || first.cancelled) return first;
  const failure = linkFailure(readFileSync(opts.logPath, 'utf8'));
  if (!failure) return first;
  const note = recoverLink(opts.targetDir, failure);
  const again = runOnce(cmd, opts, hooks);
  appendFileSync(opts.logPath, `
[broker] ${note}; first run exit ${first.exit}, retry exit ${again.exit}
`);
  return { ...again, durationMs: first.durationMs + again.durationMs, recovered: note };
}

function runOnce(cmd, { cwd, targetDir, logPath, jobs }, { shouldCancel, pollMs = DEFAULT_POLL_MS }) {
  const composed = composeCommand(cmd, { jobs, cwd });
  const marker = `${logPath}.exit`;
  rmSync(marker, { force: true });
  const fd = openSync(logPath, 'w');
  const started = Date.now();
  let child;
  try {
    child = spawn(process.execPath, [CHILD, marker, composed], {
      cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', fd, fd],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', CARGO_TARGET_DIR: targetDir },
    });
    child.unref();
  } finally { closeSync(fd); }
  trackChild({ pid: child.pid, marker, logPath, cmd });
  let cancelled = false;
  while (!existsSync(marker)) {
    if (shouldCancel()) { cancelled = true; killTree(child.pid); break; }
    pulse();
    sleep(pollMs);
  }
  untrackChild(child.pid);
  const exit = cancelled ? 1 : Number(readFileSync(marker, 'utf8')) || 0;
  rmSync(marker, { force: true });
  return { cmd: String(cmd).trim(), composed, exit, durationMs: Date.now() - started, logTail: tail(logPath), cancelled };
}
