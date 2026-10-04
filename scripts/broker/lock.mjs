// lock.mjs — a single-broker-per-checkout lock. Two brokers on one build checkout would fight
// over HEAD and the index, so startup takes an exclusive lock and refuses if a LIVE broker
// already holds it. A stale lock (the holder pid is gone — a crash) is reclaimed, which is what
// makes an idempotent restart possible.

import { writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { hostname } from 'node:os';
import { ensureDirs } from './result.mjs';
import { brokerPaths } from './config.mjs';

// Acquire the lock. Returns { ok:true } or { ok:false, holder } when a live broker holds it.
// The lock is created exclusively, so two daemons starting together cannot both win: the loser
// finds a live holder (or a lock the winner just wrote) and exits.
export function acquireLock(cfg) {
  ensureDirs(cfg);
  const path = brokerPaths(cfg).lock;
  const record = JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }, null, 2);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      writeFileSync(path, record, { flag: 'wx' });
      rmSync(brokerPaths(cfg).spawning, { force: true });
      return { ok: true };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const held = liveHolder(cfg);
    if (held) return { ok: false, holder: held };
    rmSync(path, { force: true });
  }
  return { ok: false, holder: readLock(path) || { pid: 0, host: hostname(), ts: '' } };
}

// The lock record when a live broker holds it, else null (no lock, or a dead pid on this host).
// A lock written on another host is treated as live: its pid cannot be probed from here.
export function liveHolder(cfg) {
  const held = readLock(brokerPaths(cfg).lock);
  if (!held) return null;
  if (held.host !== hostname()) return held;
  return pidAlive(held.pid) ? held : null;
}

const BEAT_FRESH_MS = 60_000;

/** The daemon calls this each poll; observers read it when a pid probe cannot see the daemon. */
export function heartbeat(cfg) {
  try { writeFileSync(brokerPaths(cfg).beat, new Date().toISOString()); } catch { /* best effort */ }
}

/** Liveness for observers (wait, health): the lock holder, or a heartbeat from the last minute. */
export function observedLive(cfg, now = Date.now()) {
  const held = liveHolder(cfg);
  if (held) return held;
  try {
    const lock = readLock(brokerPaths(cfg).lock);
    return lock && now - statSync(brokerPaths(cfg).beat).mtimeMs < BEAT_FRESH_MS ? lock : null;
  } catch { return null; }
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
