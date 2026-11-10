// handover.mjs — a daemon passes its lane to a fresh daemon started from the published runtime (KIT-T486,
// KIT-T500). The successor's lock names this hand-over as the reason it started, never the first daemon's
// spawn reason, and a launch that fails leaves the lane with the old daemon instead of with none (KIT-T957).
//
//   handoverArgs(argv, reason) -> the successor's argv: the flags the launcher sets itself dropped, `--spawned-by reason` last
//   handOver({ cfg, root, argv, why, current, canStay, launch?, release?, take?, pid? })
//     -> { handedOver: true } | { handedOver: false, error, stayed }
//     `stayed` is true when the launch failed, the old runtime can still run (`canStay`) and the lock was taken back.

import { join } from 'node:path';
import { launchDaemon } from './launch.mjs';
import { acquireLock, releaseLock } from './lock.mjs';

const LAUNCHER_FLAGS = new Set(['--root', '--log', '--spawned-by']);

export function handoverArgs(argv, reason) {
  const kept = argv.filter((a, i) => !LAUNCHER_FLAGS.has(a) && !LAUNCHER_FLAGS.has(argv[i - 1]));
  return [...kept, '--spawned-by', reason];
}

export function handOver({ cfg, root, argv, why, current, canStay, launch = launchDaemon, release = releaseLock, take = acquireLock, pid = process.pid }) {
  release(cfg);
  const started = current
    ? launch(join(current, 'scripts', 'broker', 'broker.mjs'), root, handoverArgs(argv, `broker.mjs pid ${pid}: ${why}`))
    : { ok: false, error: 'no published runtime to restart from' };
  if (started.ok) return { handedOver: true };
  return { handedOver: false, error: started.error, stayed: canStay && take(cfg).ok };
}
