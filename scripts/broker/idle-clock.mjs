// idle-clock.mjs — when a daemon counts itself idle (KIT-T916). The idle-exit clock only runs while nothing is
// queued, measuring or paused, so a daemon never exits behind a job that waits.
//
//   workPending(cfg, processed) -> true when the last drain processed jobs, or queue/ or measure/ holds a job, or the broker is paused
//   idleExpired({ idleMs, lastWork, now? }) -> true when idleMs is set and more than idleMs passed since lastWork

import { isPaused } from './control.mjs';
import { listMeasure, listQueue } from './result.mjs';

export const workPending = (cfg, processed = []) => processed.length > 0 || listQueue(cfg).length > 0 || listMeasure(cfg).length > 0 || isPaused(cfg);

export const idleExpired = ({ idleMs, lastWork, now = Date.now() }) => idleMs > 0 && now - lastWork > idleMs;
