// daemon-state.mjs — what `broker status` prints about one lane's daemon: ALIVE, STALLED or DEAD, with the heartbeat age
// (KIT-T838). The lock's `spawnedBy` text names why the daemon was started ("1 job(s) queued with no daemon"), so it is
// printed as history, never as the present state. A lane with jobs queued says how long the oldest has waited (KIT-T957):
// DEAD with a queue is flagged as queued without a daemon; a live daemon adds the tree locks other lanes hold.
//
//   daemonStateLine(cfg, now?) -> 'broker: ALIVE | STALLED | DEAD ...', then one indented line per wait detail

import { statSync } from 'node:fs';
import { brokerPaths } from './config.mjs';
import { liveHolder } from './lock.mjs';
import { listQueue } from './result.mjs';
import { isPaused } from './control.mjs';
import { ageMinutes, oldestQueuedMs } from './queue-age.mjs';
import { otherLaneTreeHolders } from './subtree.mjs';
import { STALL_MS } from './stall.mjs';

const MS_PER_S = 1000;

function beatAgeMs(cfg, held, now) {
  try { return now - statSync(brokerPaths(cfg).beat).mtimeMs; } catch { return now - (Date.parse(held.ts) || now); }
}

const startedLine = (held) => `started ${held.ts || '?'}${held.spawnedBy ? ` by ${held.spawnedBy}` : ''}${held.log ? `, log ${held.log}` : ''}`;
const laneName = (cfg) => cfg.lane || 'root';
const waitedMin = (cfg, now) => ageMinutes(oldestQueuedMs(cfg, now) ?? 0);

function deadLine(cfg, queued, now) {
  const flag = queued ? `, QUEUED WITHOUT A DAEMON in lane ${laneName(cfg)}: oldest waiting ${waitedMin(cfg, now)} min` : '';
  return `broker: DEAD, no daemon holds the lock, ${queued} queued${flag} (submit, wait or status starts one)`;
}

const waitLines = (cfg, now) => [
  `  oldest queued job has waited ${waitedMin(cfg, now)} min`,
  ...otherLaneTreeHolders(cfg).map((h) => `  ${h.tree} tree is held by lane ${h.lane} (${h.id}, pid ${h.pid}); a job that needs it waits`),
];

export function daemonStateLine(cfg, now = Date.now()) {
  const queued = listQueue(cfg).length;
  const held = liveHolder(cfg);
  if (!held) return deadLine(cfg, queued, now);
  const age = Math.round(beatAgeMs(cfg, held, now) / MS_PER_S);
  const pause = isPaused(cfg) ? ', PAUSED' : '';
  const state = queued && age * MS_PER_S > STALL_MS ? 'STALLED' : 'ALIVE';
  const head = `broker: ${state}, pid ${held.pid} (runtime ${held.runtime || '?'}), heartbeat ${age} s ago, ${queued} queued${pause}; ${startedLine(held)}`;
  return queued ? [head, ...waitLines(cfg, now)].join('\n') : head;
}
