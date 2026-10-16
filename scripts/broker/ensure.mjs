// ensure.mjs — keep a daemon behind the queue (KIT-T301). A job queued while no live broker
// holds the lock would sit unstarted, so submit starts one; wait names the gap instead of
// timing out silently.

import { join } from 'node:path';
import { rmSync, statSync, writeFileSync } from 'node:fs';
import { brokerPaths, laneConfigs, withLane } from './config.mjs';
import { liveHolder, observedLive } from './lock.mjs';
import { ensureDirs } from './result.mjs';
import { listQueue } from './result.mjs';
import { restartIfWedged } from './stall.mjs';
import { launchDaemon } from './launch.mjs';

export const IDLE_EXIT_MIN = 60;
const BROKER = join(import.meta.dirname, 'broker.mjs');

// Start the daemon owned by no caller, hidden, logging to target/broker/logs (launch.mjs). The lock
// records `spawnedBy` ("<caller script> pid N: <why>"); a replacement for a killed daemon gets no
// --idle-exit. The idle exit only counts minutes with an empty queue, so it never leaves jobs waiting.
const caller = () => `${process.argv[1] ? process.argv[1].split(/[\\/]/).pop() : 'node'} pid ${process.pid}`;

export function spawnBroker(root, idleExit = IDLE_EXIT_MIN, why = 'started', lane = null) {
  const r = launchDaemon(BROKER, root, [...(lane ? ['--lane', lane] : []), ...(idleExit ? ['--idle-exit', String(idleExit)] : []), '--spawned-by', `${caller()}: ${why}`]);
  if (!r.ok) console.error(`broker: could not start a daemon: ${r.error}`);
  return r;
}

/** Start a broker unless a live one holds the lock; a holder stalled past RESTART_MS is killed and replaced (stall.mjs). `spawner(root, idleExit)` is injectable. Returns true when it started one. */
export function ensureBroker(cfg, root, spawner = spawnBroker) {
  if (liveHolder(cfg)) return restartIfWedged(cfg, root, { spawner: (r, why) => spawner(r, null, why, cfg.lane) });
  if (!claimSpawn(cfg)) return false;
  spawner(root, IDLE_EXIT_MIN, `${listQueue(cfg).length} job(s) queued with no daemon`, cfg.lane);
  return true;
}

/**
 * Start a daemon behind every lane of the checkout that holds queued jobs and has none, so a queue
 * never waits for a wait.mjs to notice (KIT-T549 c). submit and `status` run it. Returns the lane
 * names it started ('root' for the superproject's).
 */
export function ensureQueuedLanes(cfg, root, spawner = spawnBroker) {
  return laneConfigs(withLane(cfg, null)).filter((lane) => listQueue(lane).length && ensureBroker(lane, root, spawner)).map((lane) => lane.lane || 'root');
}

const SPAWN_CLAIM_MS = 30_000;

// One auto-start at a time: the first caller creates the marker exclusively, a daemon that takes
// the lock removes it, and a marker older than SPAWN_CLAIM_MS (a daemon that never came up) is taken over.
function claimSpawn(cfg) {
  const marker = ensureDirs(cfg) && brokerPaths(cfg).spawning;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { writeFileSync(marker, String(process.pid), { flag: 'wx' }); return true; } catch (e) { if (e.code !== 'EEXIST') return false; }
    try { if (Date.now() - statSync(marker).mtimeMs < SPAWN_CLAIM_MS) return false; rmSync(marker, { force: true }); } catch { /* raced away */ }
  }
  return false;
}

export const NO_BROKER_GRACE_MS = 10_000;

/**
 * A warning line when `id` is still queued and no live broker holds the lock, else null. A broker
 * being restarted is down for a moment, so the gap must have lasted `missingForMs` >= the grace.
 */
export function noBrokerWarning(cfg, id, { missingForMs = NO_BROKER_GRACE_MS, graceMs = NO_BROKER_GRACE_MS } = {}) {
  if (missingForMs < graceMs || observedLive(cfg) || !listQueue(cfg).some((j) => j.id === id)) return null;
  return `wait: no broker running — ${id} is queued but nothing will start it (start one: node ${BROKER} --root ${cfg.root}${cfg.lane ? ` --lane ${cfg.lane}` : ''})`;
}
