// daemon-state.mjs — the one line `broker status` prints about the daemon: ALIVE, STALLED or DEAD, with the heartbeat age
// (KIT-T838). The lock's `spawnedBy` text names why the daemon was started ("1 job(s) queued with no daemon"), so it is
// printed as history, never as the present state.
//
//   daemonStateLine(cfg, now?) -> 'broker: ALIVE | STALLED | DEAD ...' (one line, no newline)

import { statSync } from 'node:fs';
import { brokerPaths } from './config.mjs';
import { liveHolder } from './lock.mjs';
import { listQueue } from './result.mjs';
import { isPaused } from './control.mjs';
import { STALL_MS } from './stall.mjs';

const MS_PER_S = 1000;

function beatAgeMs(cfg, held, now) {
  try { return now - statSync(brokerPaths(cfg).beat).mtimeMs; } catch { return now - (Date.parse(held.ts) || now); }
}

const startedLine = (held) => `started ${held.ts || '?'}${held.spawnedBy ? ` by ${held.spawnedBy}` : ''}${held.log ? `, log ${held.log}` : ''}`;

export function daemonStateLine(cfg, now = Date.now()) {
  const queued = listQueue(cfg).length;
  const held = liveHolder(cfg);
  if (!held) return `broker: DEAD, no daemon holds the lock, ${queued} queued (submit, wait or status starts one)`;
  const age = Math.round(beatAgeMs(cfg, held, now) / MS_PER_S);
  const pause = isPaused(cfg) ? ', PAUSED' : '';
  const state = queued && age * MS_PER_S > STALL_MS ? 'STALLED' : 'ALIVE';
  return `broker: ${state}, pid ${held.pid} (runtime ${held.runtime || '?'}), heartbeat ${age} s ago, ${queued} queued${pause}; ${startedLine(held)}`;
}
