// heartbeat.mjs — one line saying where a waited-on job is (KIT-T483), so a worker blocked in
// wait.mjs shows progress instead of a silent timer: its queue position and the job ahead, or
// how long it has been running and which of its commands is on, or which landing phase it is in
// (commit, pre-push gate, rebase, reverify, push, pin) and for how long.
//
// `heartbeatLine(cfg, id, now?)` → a line, or null once the job is neither queued nor in flight.

import { existsSync, readdirSync } from 'node:fs';
import { brokerPaths } from './config.mjs';
import { readInflight } from './preimage.mjs';
import { listQueue } from './result.mjs';
import { readPhase } from './phase.mjs';

const MS_PER_SEC = 1000;

// The highest command log index the job has opened, or -1.
function runningCommand(cfg, id) {
  const logs = brokerPaths(cfg).logs;
  if (!existsSync(logs)) return -1;
  const re = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.log$`);
  return Math.max(-1, ...readdirSync(logs).map((f) => Number((f.match(re) || [])[1] ?? -1)));
}

export function heartbeatLine(cfg, id, now = Date.now()) {
  const inflight = readInflight(cfg);
  if (inflight && inflight.id === id) {
    const secs = Math.round((now - Date.parse(inflight.startedAt)) / MS_PER_SEC);
    const ph = readPhase(cfg);
    if (ph && ph.id === id && ph.phase !== 'run') return `wait: ${id} running ${secs}s, phase ${ph.phase} for ${Math.round((now - Date.parse(ph.since)) / MS_PER_SEC)}s`;
    const n = runningCommand(cfg, id);
    return `wait: ${id} running ${secs}s${n >= 0 ? `, on command ${n + 1}` : ', applying'}`;
  }
  const queue = listQueue(cfg);
  const at = queue.findIndex((j) => j.id === id);
  if (at < 0) return null;
  const ahead = inflight ? `; ${inflight.id} is running` : '';
  return `wait: ${id} queued at position ${at + 1} of ${queue.length}${ahead}`;
}
