// run-cancellable.mjs — `runCommand` that can be abandoned (KIT-T310). The command runs in a
// child process tree; the caller polls `shouldCancel()` between checks and, when it returns
// true, the whole tree is killed (taskkill /T /F on Windows, a process-group SIGKILL elsewhere).
// Synchronous like runCommand: it blocks between polls without spinning.
//
// `runCancellable(cmd, { cwd, targetDir, logPath, jobs }, { shouldCancel, pollMs })`
//   -> the runCommand result plus `cancelled: boolean`.

import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { composeCommand, tail } from './run.mjs';

const CHILD = join(import.meta.dirname, 'run-child.mjs');
const DEFAULT_POLL_MS = 500;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ } }
}

export function runCancellable(cmd, { cwd, targetDir, logPath, jobs }, { shouldCancel, pollMs = DEFAULT_POLL_MS }) {
  const composed = composeCommand(cmd, { jobs });
  const marker = `${logPath}.exit`;
  rmSync(marker, { force: true });
  const fd = openSync(logPath, 'w');
  const started = Date.now();
  let child;
  try {
    child = spawn(process.execPath, [CHILD, marker, composed], {
      cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', fd, fd],
      env: { ...process.env, CARGO_TARGET_DIR: targetDir },
    });
    child.unref();
  } finally { closeSync(fd); }
  let cancelled = false;
  while (!existsSync(marker)) {
    if (shouldCancel()) { cancelled = true; killTree(child.pid); break; }
    sleep(pollMs);
  }
  const exit = cancelled ? 1 : Number(readFileSync(marker, 'utf8')) || 0;
  rmSync(marker, { force: true });
  return { cmd: String(cmd).trim(), composed, exit, durationMs: Date.now() - started, logTail: tail(logPath), cancelled };
}
