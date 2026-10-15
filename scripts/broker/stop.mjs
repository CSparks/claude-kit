// stop.mjs — the `broker.mjs stop` command (KIT-T501, KIT-T525): ask a live daemon to exit at its next safe
// point (a deferred or suite run is cancelled). Queued or running jobs make it refuse unless `--now`,
// which kills the running command and restores the tree from the journal (stop-now.mjs).
//
// `stopDaemon(cfg, { now })` → { code, text }.

import { requestStop } from './control.mjs';
import { rmSync } from 'node:fs';
import { brokerPaths } from './config.mjs';
import { liveHolder, readLock } from './lock.mjs';
import { listQueue } from './result.mjs';

export function stopDaemon(cfg, { now = false } = {}) {
  const holder = liveHolder(cfg);
  if (!holder) {
    const lock = brokerPaths(cfg).lock;
    const stale = readLock(lock);
    if (stale) rmSync(lock, { force: true });
    return { code: 0, text: `broker: no daemon is running${stale ? `; cleared the stale lock of dead pid ${stale.pid}` : ''}` };
  }
  const jobs = listQueue(cfg).length;
  if (jobs && !now) return { code: 1, text: `broker: pid ${holder.pid} has ${jobs} job(s) queued or running; \`stop --now\` kills the running command, restores the tree and exits` };
  requestStop(cfg, { now });
  return { code: 0, text: `broker: pid ${holder.pid} will exit ${now && jobs ? 'now (running command killed, tree restored)' : 'at its next safe point (a deferred or suite run is cancelled)'}` };
}
