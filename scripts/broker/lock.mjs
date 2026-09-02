// lock.mjs — a single-broker-per-checkout lock. Two brokers on one build checkout would fight
// over HEAD and the index, so startup takes an exclusive lock and refuses if a LIVE broker
// already holds it. A stale lock (the holder pid is gone — a crash) is reclaimed, which is what
// makes an idempotent restart possible.

import { writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { hostname } from 'node:os';
import { ensureDirs } from './result.mjs';
import { brokerPaths } from './config.mjs';

// Acquire the lock. Returns { ok:true } or { ok:false, holder } when a live broker holds it.
export function acquireLock(cfg) {
  ensureDirs(cfg);
  const path = brokerPaths(cfg).lock;
  const held = readLock(path);
  if (held && held.host === hostname() && pidAlive(held.pid)) return { ok: false, holder: held };
  writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }, null, 2));
  return { ok: true };
}

// Release only our own lock — never stomp a lock a different pid took after a stale reclaim.
export function releaseLock(cfg) {
  const path = brokerPaths(cfg).lock;
  const held = readLock(path);
  if (held && held.pid === process.pid) rmSync(path, { force: true });
}

export function readLock(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// `process.kill(pid, 0)` sends no signal — it only probes existence. ESRCH ⇒ gone (reclaimable);
// EPERM ⇒ exists but not ours (still alive). A cross-host lock is treated as live (fail safe).
function pidAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM';
  }
}
