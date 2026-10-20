// stall.mjs — a daemon that holds the lock but stopped beating while jobs wait (KIT-T488). The
// daemon beats between jobs and, through `pulse()`, every second while a command runs, so a beat
// older than STALL_MS with a non-empty queue means it is wedged, not busy.
//
// `setPulse(fn)` / `pulse()` — the daemon registers its heartbeat; long-running waits call pulse().
// `stallState(cfg, now?)` → null, or { beatAgeMs, queued, pid } for a live lock holder that stalled.
// `stallLine(s)` → "STALLED: no beat for N s, M queued (pid P)".
// `restartIfWedged(cfg, root, { now, kill, spawner })` → true when it killed a holder stalled past
//   the kill limit (`stall_kill_s`, default RESTART_MS; 0 never kills) and started a new daemon (the
//   new one restores the journal and re-runs the job). It never kills a daemon inside a landing
//   phase (phase.json) or past its commit (inflight.json `committed`): a push or a repo gate that
//   long is the gate's time, and a restart there would strand the commit. It never kills a daemon whose
//   command child is alive and still writing its log (busy, not wedged), and the kill resets the beat
//   (a replacement's first beat comes after its start-up, which a poller must not read as a stall). The kill is written to killed.json, and the
//   job's next result carries it (result.mjs).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { liveHolder } from './lock.mjs';
import { listQueue } from './result.mjs';

export const STALL_MS = 2 * 60 * 1000;
export const RESTART_MS = 10 * 60 * 1000;
const PULSE_EVERY_MS = 1000;
const MS_PER_S = 1000;
export const LAND_PHASES = new Set(['commit', 'pre-push gate', 'rebase', 'reverify', 'push', 'pin', 'resume']);

const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };

/** The kill limit in ms, or 0 when this checkout never kills (`stall_kill_s: 0`). */
export const killLimitMs = (cfg) => (cfg.stallKillS == null ? RESTART_MS : cfg.stallKillS * MS_PER_S);

/** Why a stalled holder must not be killed, or null: it is landing or past its commit. */
export function landingHold(cfg) {
  const home = brokerPaths(cfg).home;
  const phase = readJson(join(home, 'phase.json'));
  const inflight = readJson(join(home, 'inflight.json'));
  if (inflight && inflight.committed) return `job ${inflight.id} is past its commit ${String(inflight.committed.sha).slice(0, 10)}`;
  if (phase && inflight && LAND_PHASES.has(phase.phase)) return `job ${inflight.id} is in its ${phase.phase} phase`;
  return null;
}

let beat = null;
let last = 0;
export const setPulse = (fn) => { beat = fn; };
export const pulseActive = () => typeof beat === "function";
export function pulse() {
  if (!beat || Date.now() - last < PULSE_EVERY_MS) return;
  last = Date.now();
  beat();
}

const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
};

/** A command child of the holder that is alive and wrote its log within STALL_MS: the daemon is busy, not wedged. */
export function activeChild(cfg, now = Date.now()) {
  const rows = readJson(join(brokerPaths(cfg).home, 'children.json')) || [];
  return rows.find((r) => {
    if (!alive(r.pid) || !r.logPath || !existsSync(r.logPath)) return false;
    try { return now - statSync(r.logPath).mtimeMs < STALL_MS; } catch { return false; }
  }) || null;
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
  const limit = killLimitMs(cfg);
  if (!s || !limit || s.beatAgeMs < limit || landingHold(cfg) || activeChild(cfg, now)) return false;
  const home = brokerPaths(cfg).home;
  const inflight = readJson(join(home, 'inflight.json'));
  const phase = readJson(join(home, 'phase.json'));
  if (inflight) {
    const kills = readJson(join(home, 'killed.json')) || [];
    kills.push({ ids: [inflight.id, ...(inflight.members || [])], pid: s.pid, at: new Date(now).toISOString(), beatAgeS: Math.round(s.beatAgeMs / MS_PER_S), phase: phase ? phase.phase : null });
    writeFileSync(join(home, 'killed.json'), JSON.stringify(kills, null, 2));
  }
  kill(s.pid);
  rmSync(brokerPaths(cfg).lock, { force: true });
  try { writeFileSync(brokerPaths(cfg).beat, new Date(now).toISOString()); } catch { /* best effort */ }
  console.error(`broker: ${stallLine(s)}; killed it and started a new daemon (it restores the tree and re-runs the job)`);
  if (spawner) spawner(root, `replaced pid ${s.pid}, silent ${Math.round(s.beatAgeMs / MS_PER_S)} s${inflight ? ` on ${inflight.id}${phase ? ` (${phase.phase})` : ''}` : ''}`);
  return true;
}
