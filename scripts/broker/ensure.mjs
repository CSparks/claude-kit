// ensure.mjs — keep a daemon behind the queue (KIT-T301). A job queued while no live broker
// holds the lock would sit unstarted, so submit starts one; wait names the gap instead of
// timing out silently.

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { liveHolder } from './lock.mjs';
import { listQueue } from './result.mjs';

export const IDLE_EXIT_MIN = 60;
const BROKER = join(import.meta.dirname, 'broker.mjs');

// Start the daemon detached and hidden; it outlives this process.
export function spawnBroker(root, idleExit = IDLE_EXIT_MIN) {
  const child = spawn(process.execPath, [BROKER, '--root', root, '--idle-exit', String(idleExit)], {
    cwd: root, detached: true, stdio: 'ignore', windowsHide: true,
  });
  child.unref();
}

/** Start a broker unless a live one holds the lock. `spawner(root, idleExit)` is injectable. Returns true when it started one. */
export function ensureBroker(cfg, root, spawner = spawnBroker) {
  if (liveHolder(cfg)) return false;
  spawner(root, IDLE_EXIT_MIN);
  return true;
}

/** A warning line when `id` is still queued and no live broker holds the lock, else null. */
export function noBrokerWarning(cfg, id) {
  if (liveHolder(cfg) || !listQueue(cfg).some((j) => j.id === id)) return null;
  return `wait: no broker running — ${id} is queued but nothing will start it (start one: node ${BROKER} --root ${cfg.root})`;
}
