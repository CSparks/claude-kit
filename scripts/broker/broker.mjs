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
//   node broker.mjs cancel <job-id> --root <checkout>  # withdraw a QUEUED job; a running one is refused
//   node broker.mjs status --root <checkout>           # queue, pause, deferred foreign failures
// Start it with background Bash; a second start while one is live exits 1 (restart is idempotent).

import { parseFlags, loadCfg } from './cli.mjs';
import { isPaused, pause, resume } from './control.mjs';
import { deferredLines } from './deferred.mjs';
import { announce, healthLine, selfCheck } from './health.mjs';
import { acquireLock, heartbeat, releaseLock } from './lock.mjs';
import { recoverInflight } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { STATUS, ensureDirs, listQueue } from './result.mjs';
import { suiteLine } from './suite.mjs';
import { pinRuntime } from '../runtime-pin.mjs';
import { setPulse, stallLine, stallState } from './stall.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { runtimeCurrent } from '../runtime-path.mjs';
import { withdrawJob } from './withdraw.mjs';

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

if (command === 'cancel') {
  const id = flags._[1];
  if (!id) { console.error('broker: cancel needs a job id'); process.exit(2); }
  const gone = withdrawJob(cfg, id, { status: STATUS.CANCELLED, message: 'cancelled by the operator' });
  console.error(gone.ok ? `broker: cancelled queued ${id}` : `broker: ${gone.error}`);
  process.exit(gone.ok ? 0 : 1);
}

if (command === 'status') {
  const queued = listQueue(cfg).length;
  const stall = stallState(cfg);
  console.error(`broker: ${stall ? stallLine(stall) : `${isPaused(cfg) ? 'PAUSED' : 'running'}, ${queued} queued`}`);
  for (const line of deferredLines(cfg)) console.error(`  ${line}`);
  const suite = suiteLine(cfg);
  if (suite) console.error(`  ${suite}`);
  for (const e of selfCheck(cfg).entries) console.error(`  ${healthLine(e)}`);
  process.exit(0);
}

const lock = acquireLock(cfg);
if (lock.ok) { pinRuntime(); setPulse(() => heartbeat(cfg)); }
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

const said = new Set();
let lastNote = '';
const note = (text) => { if (text !== lastNote) console.error(text); lastNote = text; };

const drain = () => {
  heartbeat(cfg);
  announce(selfCheck(cfg, { heal: true }).entries, said);
  const summary = processOnce(cfg, { onResult: (r) => console.error(`  ${r.id} → ${r.status}`) });
  if (summary.paused) note(summary.reason === 'manual' ? 'broker: paused by operator; `resume` to continue' : `broker: paused — ${summary.pausedRepos.join(', ')} holds hand edits (job ${summary.pausedOn} stays queued)`);
  else lastNote = '';
  if (summary.suite) console.error(`  suite ${summary.suite.sha.slice(0, 7)} → ${summary.suite.status}${summary.suite.filed ? ' (regression filed)' : ''}`);
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
// A publish that pruned this daemon's runtime copy (KIT-T486) leaves it unable to load its hooks:
// it hands the lock to a fresh daemon started from `current` and exits.
const runtimeGone = () => !existsSync(join(import.meta.dirname, 'gate.mjs'));
function restartFromCurrent() {
  const cur = runtimeCurrent();
  releaseLock(cfg);
  if (cur) spawn(process.execPath, [join(cur, 'scripts', 'broker', 'broker.mjs'), ...process.argv.slice(2)], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.error(`broker: runtime gone (${import.meta.dirname}); ${cur ? `restarted from ${cur}` : 'no published runtime to restart from'}`);
  process.exit(0);
}

const tick = () => {
  if (runtimeGone()) restartFromCurrent();
  const { processed } = drain();
  if (processed.length || listQueue(cfg).length || isPaused(cfg)) lastWork = Date.now();
  if (idleMs && Date.now() - lastWork > idleMs) stop(`idle for ${flags['idle-exit']} min, exiting`);
  setTimeout(tick, pollMs);
};
tick();
