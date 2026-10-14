// stall.mjs — a daemon that holds the lock but stopped beating while jobs wait (KIT-T488). The
// daemon beats between jobs and, through `pulse()`, every second while a command runs, so a beat
// older than STALL_MS with a non-empty queue means it is wedged, not busy.
//
// `setPulse(fn)` / `pulse()` — the daemon registers its heartbeat; long-running waits call pulse().
// `stallState(cfg, now?)` → null, or { beatAgeMs, queued, pid } for a live lock holder that stalled.
// `stallLine(s)` → "STALLED: no beat for N s, M queued (pid P)".
// `restartIfWedged(cfg, root, { now, kill, spawner })` → true when it killed a holder stalled past
//   RESTART_MS and started a new daemon (the new one restores the journal and re-runs the job).

import { spawnSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { brokerPaths } from './config.mjs';
import { liveHolder } from './lock.mjs';
import { listQueue } from './result.mjs';

export const STALL_MS = 2 * 60 * 1000;
export const RESTART_MS = 10 * 60 * 1000;
const PULSE_EVERY_MS = 1000;

let beat = null;
let last = 0;
export const setPulse = (fn) => { beat = fn; };
export const pulseActive = () => typeof beat === "function";
export function pulse() {
  if (!beat || Date.now() - last < PULSE_EVERY_MS) return;
  last = Date.now();
  beat();
}

export function stallState(cfg, now = Date.now()) {
  const held = liveHolder(cfg);
  if (!held) return null;
  const queued = listQueue(cfg).length;
  if (!queued) return null;
  let beatAt;
  try { beatAt = statSync(brokerPaths(cfg).beat).mtimeMs; } catch { beatAt = Date.parse(held.ts) || now; }
  const beatAgeMs = now - beatAt;
  return beatAgeMs > STALL_MS ? { beatAgeMs, queued, pid: held.pid } : null;
}

export const stallLine = (s) => `STALLED: no beat for ${Math.round(s.beatAgeMs / 1000)} s, ${s.queued} queued (pid ${s.pid})`;

function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
}

export function restartIfWedged(cfg, root, { now = Date.now(), kill = killTree, spawner } = {}) {
  const s = stallState(cfg, now);
  if (!s || s.beatAgeMs < RESTART_MS) return false;
  kill(s.pid);
  rmSync(brokerPaths(cfg).lock, { force: true });
  console.error(`broker: ${stallLine(s)}; killed it and started a new daemon (it restores the tree and re-runs the job)`);
  if (spawner) spawner(root);
  return true;
}
