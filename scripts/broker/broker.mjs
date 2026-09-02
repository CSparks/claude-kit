#!/usr/bin/env node
// broker.mjs — the daemon. ONE per build checkout; it owns the checkout and its shared
// CARGO_TARGET_DIR and is the only thing that runs cargo there. It takes an exclusive lock,
// drains the queue serially, and on a dirty checkout pauses (keeps polling) until the tree is
// clean again — the coexistence rule with a hand-driven writer.
//
// USE:
//   node broker.mjs --root <build-checkout>            # run the daemon (Ctrl-C to stop)
//   node broker.mjs --root <build-checkout> --once     # drain once and exit (ops/tests)
//   node broker.mjs --root <build-checkout> --poll 2000

import { parseFlags, loadCfg } from './cli.mjs';
import { acquireLock, releaseLock } from './lock.mjs';
import { processOnce } from './queue.mjs';
import { ensureDirs } from './result.mjs';

const flags = parseFlags(process.argv.slice(2));
const { root, cfg } = loadCfg(flags);
ensureDirs(cfg);

const lock = acquireLock(cfg);
if (!lock.ok) {
  console.error(`broker: another broker holds the lock (pid ${lock.holder.pid} on ${lock.holder.host} since ${lock.holder.ts})`);
  process.exit(1);
}

let stopping = false;
const stop = () => {
  stopping = true;
  releaseLock(cfg);
  console.error('broker: stopped');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.error(`broker: watching ${root} (target ${cfg.targetDir}, jobs -j ${cfg.jobs})`);

const drain = () => {
  const summary = processOnce(cfg, { onResult: (r) => console.error(`  ${r.id} → ${r.status}`) });
  if (summary.paused) console.error(`broker: paused — build checkout dirty (job ${summary.pausedOn} re-queued); waiting for a clean tree`);
  return summary;
};

if (flags.once) {
  drain();
  releaseLock(cfg);
  process.exit(0);
}

const pollMs = Number(flags.poll) || cfg.pollMs;
const tick = () => {
  if (stopping) return;
  drain();
  if (!stopping) setTimeout(tick, pollMs);
};
tick();
