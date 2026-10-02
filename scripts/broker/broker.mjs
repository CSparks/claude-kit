#!/usr/bin/env node
// broker.mjs — the daemon. ONE per checkout; it is the only writer there: it applies queued
// patches, gates, builds, tests, and lands them, serially, with the checkout's shared
// CARGO_TARGET_DIR. It takes an exclusive lock. It pauses (keeps polling) while the tree holds
// a hand-driven writer's changes, or after `pause`, until the tree is free again.
//
// USE:
//   node broker.mjs --root <checkout>                  # run the daemon (Ctrl-C to stop)
//   node broker.mjs --root <checkout> --idle-exit 30   # also exit after 30 idle minutes
//   node broker.mjs --root <checkout> --once           # drain once and exit (ops/tests)
//   node broker.mjs --root <checkout> --poll 2000
//   node broker.mjs pause --root <checkout>            # stop starting jobs (one in flight finishes)
//   node broker.mjs resume --root <checkout>
// Start it with background Bash; a second start while one is live exits 1 (restart is idempotent).

import { parseFlags, loadCfg } from './cli.mjs';
import { isPaused, pause, resume } from './control.mjs';
import { acquireLock, releaseLock } from './lock.mjs';
import { recoverInflight } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { ensureDirs, listQueue } from './result.mjs';

const MS_PER_MIN = 60 * 1000;
const flags = parseFlags(process.argv.slice(2));
const { root, cfg } = loadCfg(flags);
ensureDirs(cfg);

const command = flags._[0];
if (command === 'pause' || command === 'resume') {
  (command === 'pause' ? pause : resume)(cfg);
  console.error(`broker: ${command === 'pause' ? 'paused' : 'resumed'} (${root})`);
  process.exit(0);
}

const lock = acquireLock(cfg);
if (!lock.ok) {
  console.error(`broker: another broker holds the lock (pid ${lock.holder.pid} on ${lock.holder.host} since ${lock.holder.ts})`);
  process.exit(1);
}

const stop = (why = 'stopped') => {
  releaseLock(cfg);
  console.error(`broker: ${why}`);
  process.exit(0);
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

const recovered = recoverInflight(cfg);
if (recovered) console.error(`broker: restored the tree after interrupted job ${recovered}; it re-runs`);
console.error(`broker: watching ${root} (target ${cfg.targetDir}, jobs -j ${cfg.jobs})`);

let lastNote = '';
const note = (text) => { if (text !== lastNote) console.error(text); lastNote = text; };

const drain = () => {
  const summary = processOnce(cfg, { onResult: (r) => console.error(`  ${r.id} → ${r.status}`) });
  if (summary.paused) note(summary.reason === 'manual' ? 'broker: paused by operator; `resume` to continue' : `broker: paused — tree holds hand edits (job ${summary.pausedOn} stays queued)`);
  else lastNote = '';
  return summary;
};

if (flags.once) {
  drain();
  releaseLock(cfg);
  process.exit(0);
}

const pollMs = Number(flags.poll) || cfg.pollMs;
const idleMs = (Number(flags['idle-exit']) || 0) * MS_PER_MIN;
let lastWork = Date.now();
const tick = () => {
  const { processed } = drain();
  if (processed.length || listQueue(cfg).length || isPaused(cfg)) lastWork = Date.now();
  if (idleMs && Date.now() - lastWork > idleMs) stop(`idle for ${flags['idle-exit']} min, exiting`);
  setTimeout(tick, pollMs);
};
tick();
