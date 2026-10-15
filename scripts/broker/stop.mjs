// stop.mjs — the `broker.mjs stop` command (KIT-T501): ask a live daemon to exit once its current
// job is done. Queued or running jobs make it refuse unless `--now`; the daemon is never killed.
//
// `stopDaemon(cfg, { now })` → { code, text }.

import { requestStop } from './control.mjs';
import { liveHolder } from './lock.mjs';
import { listQueue } from './result.mjs';

export function stopDaemon(cfg, { now = false } = {}) {
  const holder = liveHolder(cfg);
  if (!holder) return { code: 0, text: 'broker: no daemon is running' };
  const jobs = listQueue(cfg).length;
  if (jobs && !now) return { code: 1, text: `broker: pid ${holder.pid} has ${jobs} job(s) queued or running; \`stop --now\` lets it finish them, then exits` };
  requestStop(cfg);
  return { code: 0, text: `broker: pid ${holder.pid} will exit ${jobs ? 'after its current job' : 'within one poll'}` };
}
