// pushlock.mjs — one landing at a time per remote across every checkout on this machine (KIT-D096).
// A submodule's queue is per checkout, so two stiletto checkouts each land rapid-game through their
// own daemon; this lock, keyed by the remote URL, serializes their sync + gate + push so neither
// pushes over the other's rebase. A lock whose pid is dead is taken over.
//
// `withPushLock(remoteUrl, fn, { dir, timeoutMs, pollMs })` → fn()'s value; throws when the lock stays held past the timeout.
// `pushLockDir(env)` → BROKER_PUSH_LOCK_DIR, else ~/.claude/broker-push-locks.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const WAIT_MS = 30 * 60 * 1000;
const POLL_MS = 500;

export const pushLockDir = (env = process.env) => env.BROKER_PUSH_LOCK_DIR || join(homedir(), '.claude', 'broker-push-locks');

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function holder(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

export function withPushLock(remoteUrl, fn, { dir = pushLockDir(), timeoutMs = WAIT_MS, pollMs = POLL_MS } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${createHash('sha1').update(String(remoteUrl)).digest('hex').slice(0, 16)}.lock`);
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      writeFileSync(file, JSON.stringify({ pid: process.pid, remote: remoteUrl, at: new Date().toISOString() }), { flag: 'wx' });
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const held = holder(file);
    if (!held || !alive(held.pid)) { rmSync(file, { force: true }); continue; }
    if (Date.now() > end) throw new Error(`push lock for ${remoteUrl} held by pid ${held.pid} since ${held.at}`);
    sleep(pollMs);
  }
  try { return fn(); } finally { rmSync(file, { force: true }); }
}
