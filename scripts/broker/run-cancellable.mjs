// run-cancellable.mjs — `runCommand` that can be abandoned (KIT-T310). The command runs in a
// child process tree; the caller polls `shouldCancel()` between checks and, when it returns
// true, the whole tree is killed (taskkill /T /F on Windows, a process-group SIGKILL elsewhere).
// Synchronous like runCommand: it blocks between polls without spinning.
//
// `runCancellable(cmd, { cwd, targetDir, logPath, jobs }, { shouldCancel, pollMs })`
//   -> the runCommand result plus `cancelled: boolean`. `opts.timeoutMs` (0 = none) kills the tree when the
//   command has run that long (the slot wait is not counted); the result then has `timedOut: true`.

import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeCommand, tail } from './run.mjs';
import { pulse } from './stall.mjs';
import { linkFailure, recoverLink } from './link-recover.mjs';
import { LOCK_BACKOFF_MS, fileLockFailure, holdersOf, lockNote } from './file-lock.mjs';
import { killTree, trackChild, untrackChild } from './children.mjs';
import { acquireBuildSlot } from './build-slot.mjs';
import { FINGERPRINT_ENV } from './fingerprint-log.mjs';

const CHILD = join(import.meta.dirname, 'run-child.mjs');
const DEFAULT_POLL_MS = 500;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A recoverable failure re-runs the command: a link failure (link-recover.mjs) cleans the failing crate's
// incremental state and re-runs once; a file the OS would not let cargo remove (file-lock.mjs) re-runs after
// a back-off and names the process holding it. The log gets a trailing note and the result `recovered`.
export function runCancellable(cmd, opts, hooks) {
  const backoff = opts.lockBackoffMs || LOCK_BACKOFF_MS;
  const first = runOnce(cmd, opts, hooks);
  let run = first;
  let durationMs = first.durationMs;
  let linked = false;
  let locks = 0;
  const notes = [];
  while (run.exit !== 0 && !run.cancelled && !run.timedOut) {
    const log = readFileSync(opts.logPath, 'utf8');
    const locked = locks < backoff.length ? fileLockFailure(log) : null;
    const link = !locked && !linked ? linkFailure(log) : null;
    if (locked) {
      notes.push(lockNote(locked, holdersOf(locked, { run: opts.findHolders }), locks + 1, backoff.length));
      sleep(backoff[locks++]);
    } else if (link) {
      linked = true;
      notes.push(recoverLink(opts.targetDir, link));
    } else break;
    console.error(`broker: ${notes[notes.length - 1]}`);
    run = runOnce(cmd, opts, hooks);
    durationMs += run.durationMs;
  }
  if (!notes.length) return run;
  appendFileSync(opts.logPath, `
[broker] ${notes.join('; ')}; first run exit ${first.exit}, retry exit ${run.exit}
`);
  return { ...run, durationMs, recovered: notes.join('; ') };
}

// The command waits for its machine-wide build slot (build-slot.mjs) before it starts; the queue
// time is reported as `slotWaitMs`, and a cancel during the wait runs nothing and leaves an empty log, so a reader of `logPath` never finds it missing.
function runOnce(cmd, opts, hooks) {
  const composed = composeCommand(cmd, { jobs: opts.jobs, testThreads: opts.testThreads, cwd: opts.cwd });
  const slot = acquireBuildSlot(composed, { jobs: opts.jobs, label: String(cmd).trim(), shouldCancel: hooks.shouldCancel });
  if (slot.cancelled) writeFileSync(opts.logPath, '');
  if (slot.cancelled) return { cmd: String(cmd).trim(), composed, exit: 1, durationMs: 0, slotWaitMs: slot.waitedMs, logTail: [], cancelled: true };
  try {
    return { ...runInSlot(cmd, composed, opts, hooks), slotWaitMs: slot.waitedMs };
  } finally { slot.release(); }
}

function runInSlot(cmd, composed, { cwd, targetDir, logPath, timeoutMs = 0 }, { shouldCancel, pollMs = DEFAULT_POLL_MS }) {
  const marker = `${logPath}.exit`;
  rmSync(marker, { force: true });
  const fd = openSync(logPath, 'w');
  const started = Date.now();
  let child;
  try {
    child = spawn(process.execPath, [CHILD, marker, composed], {
      cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', fd, fd],
      env: { ...FINGERPRINT_ENV, ...process.env, PYTHONDONTWRITEBYTECODE: '1', CARGO_TARGET_DIR: targetDir },
    });
    child.unref();
  } finally { closeSync(fd); }
  trackChild({ pid: child.pid, marker, logPath, cmd });
  let cancelled = false;
  let timedOut = false;
  while (!existsSync(marker)) {
    if (shouldCancel()) { cancelled = true; killTree(child.pid); break; }
    if (timeoutMs && Date.now() - started > timeoutMs) { timedOut = true; killTree(child.pid); break; }
    pulse();
    sleep(pollMs);
  }
  untrackChild(child.pid);
  const exit = cancelled || timedOut ? 1 : Number(readFileSync(marker, 'utf8')) || 0;
  rmSync(marker, { force: true });
  return { cmd: String(cmd).trim(), composed, exit, durationMs: Date.now() - started, logTail: tail(logPath), cancelled, ...(timedOut ? { timedOut } : {}) };
}
