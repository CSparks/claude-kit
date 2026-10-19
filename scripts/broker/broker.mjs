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
//   node broker.mjs --root <checkout> --log auto       # log to target/broker/logs/daemon-<time>-<pid>.log (launch.mjs passes it)
//   node broker.mjs pause --root <checkout>            # stop starting jobs (one in flight finishes)
//   node broker.mjs resume --root <checkout>
//   node broker.mjs cancel <job-id> --root <checkout>  # withdraw a QUEUED job; a running one is refused
//   node broker.mjs status --root <checkout>           # queue, pause, deferred foreign failures
// Start it with background Bash; a second start while one is live exits 1 (restart is idempotent).

import { parseFlags, loadCfg } from './cli.mjs';
import { clearStop, isPaused, pause, resume, stopNowRequested, stopRequested } from './control.mjs';
import { deferredLines } from './deferred.mjs';
import { announce, healthLine, selfCheck } from './health.mjs';
import { dirtNotice, holdAge, holdLine, holdReport } from './hand-hold.mjs';
import { acquireLock, heartbeat, liveHolder, releaseLock } from './lock.mjs';
import { recoverInflight } from './preimage.mjs';
import { recoverUnderLock } from './recover.mjs';
import { processOnce } from './queue.mjs';
import { STATUS, ensureDirs, listQueue } from './result.mjs';
import { suiteLine } from './suite.mjs';
import { pinRuntime, runtimeTag } from '../runtime-pin.mjs';
import { publishedSwap } from './runtime-swap.mjs';
import { setPulse, stallLine, stallState } from './stall.mjs';
import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launchDaemon } from './launch.mjs';
import { brokerPaths, laneConfigs } from './config.mjs';
import { laneCfgFor } from './lanes.mjs';
import { rerouteMisplaced } from './reroute.mjs';
import { runtimeCurrent } from '../runtime-path.mjs';
import { usageProblem } from './usage.mjs';
import { reconcileSubtrees } from './subtree.mjs';
import { reapOrphans, setChildRegistry } from './children.mjs';
import { ensureQueuedLanes } from './ensure.mjs';
import { stopDaemon } from './stop.mjs';
import { setStopNow } from './stop-now.mjs';
import { cargoScopeRefusal } from './cargo-scope.mjs';
import { withdrawJob } from './withdraw.mjs';

const MS_PER_MIN = 60 * 1000;
const flags = parseFlags(process.argv.slice(2));
const problem = usageProblem(flags);
if (problem) { (problem.code ? console.error : console.log)(problem.text); process.exit(problem.code); }
const { root, cfg } = loadCfg(flags);
const rootCfg = { ...cfg, lane: null };
ensureDirs(cfg);
let logFile = null;
if (flags.log) {
  logFile = flags.log === 'auto' ? join(brokerPaths(cfg).logs, `daemon-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`) : String(flags.log);
  console.error = (...parts) => { try { appendFileSync(logFile, `${new Date().toISOString()} ${parts.join(' ')}\n`); } catch { /* the log is best effort */ } };
}

const command = flags._[0];
if (command === 'pause' || command === 'resume') {
  (command === 'pause' ? pause : resume)(cfg);
  console.error(`broker: ${command === 'pause' ? 'paused' : 'resumed'} (${root})`);
  process.exit(0);
}

if (command === 'cancel') {
  const id = flags._[1];
  const laneCfg = id ? laneCfgFor(cfg, id) : cfg;
  if (!id) { console.error('broker: cancel needs a job id'); process.exit(2); }
  const gone = withdrawJob(laneCfg, id, { status: STATUS.CANCELLED, message: 'cancelled by the operator' });
  console.error(gone.ok ? `broker: cancelled queued ${id}` : `broker: ${gone.error}`);
  process.exit(gone.ok ? 0 : 1);
}

if (command === 'stop') {
  const r = stopDaemon(cfg, { now: !!flags.now });
  console.error(r.text);
  process.exit(r.code);
}

if (command === 'stats') {
  const { statsReport } = await import('./metrics.mjs');
  const r = statsReport(cfg, { since: typeof flags.since === 'string' ? flags.since : null });
  console.log(flags.json ? JSON.stringify(r.data, null, 2) : r.text);
  process.exit(0);
}

if (command === 'status') {
  for (const lane of process.env.BROKER_NO_AUTOSTART ? [] : ensureQueuedLanes(rootCfg, root)) console.error(`broker: no daemon was behind the ${lane} queue; started one`);
  for (const cfg of flags.lane ? [rootCfg] : laneConfigs(rootCfg)) {
  if (cfg.lane) console.error(`lane ${cfg.lane}:`);
  const queued = listQueue(cfg).length;
  const stall = stallState(cfg);
  const holder = liveHolder(cfg);
  if (holder) console.error(`broker: pid ${holder.pid} (runtime ${holder.runtime || '?'})${holder.spawnedBy ? `, spawned by ${holder.spawnedBy}` : ''}${holder.log ? `, log ${holder.log}` : ''}`);
  console.error(`broker: ${stall ? stallLine(stall) : `${isPaused(cfg) ? 'PAUSED' : 'running'}, ${queued} queued`}`);
  for (const line of deferredLines(cfg)) console.error(`  ${line}`);
  const suite = suiteLine(cfg);
  if (suite) console.error(`  ${suite}`);
  const hold = holdReport(cfg);
  if (hold) console.error(`  ${holdLine(hold)} (${holdAge(hold)})`);
  for (const e of selfCheck(cfg).entries) console.error(`  ${healthLine(e)}`);
  }
  process.exit(0);
}

const notCargo = cargoScopeRefusal(root);
if (notCargo) { console.error(`broker: ${notCargo}`); process.exit(2); }
const lock = acquireLock(cfg, { spawnedBy: typeof flags['spawned-by'] === 'string' ? flags['spawned-by'] : null, log: logFile });
const childRegistry = join(brokerPaths(cfg).home, 'children.json');
if (lock.ok) { clearStop(cfg); pinRuntime(); setPulse(() => heartbeat(cfg)); setChildRegistry(childRegistry); }
if (!lock.ok) {
  console.error(`broker: another broker holds the lock (pid ${lock.holder.pid} on ${lock.holder.host} since ${lock.holder.ts})`);
  process.exit(1);
}

const stop = (why = 'stopped') => {
  releaseLock(cfg);
  console.error(`broker: ${why}`);
  process.exit(0);
};
setStopNow({
  check: () => stopNowRequested(cfg),
  exit: () => { clearStop(cfg); recoverInflight(cfg); stop('stop --now: command killed, tree restored from the journal'); },
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

for (const r of reapOrphans(childRegistry)) console.error(`broker: ended ${r.cmd} (pid ${r.pid}), left running by the daemon that died${r.interrupted ? `; its log is kept as ${r.interrupted}` : ''}`);
for (const dead of reconcileSubtrees(cfg)) console.error(`broker: reclaimed the submodule tree ${dead.id} (pid ${dead.pid}, lane ${dead.lane}) held when its daemon died${dead.restore ? '; the checkout is back on its branch' : ''}`);
let recoveryReason = null;
const recoverPending = () => {
  const r = recoverUnderLock(cfg, (line) => console.error(line));
  recoveryReason = r.done ? null : r.reason;
  return !r.done;
};
recoverPending();
console.error(`broker: watching ${root} (target ${cfg.targetDir}, jobs -j ${cfg.jobs})`);
for (const line of dirtNotice(cfg)) console.error(line);

const said = new Set();
let lastNote = '';
const note = (text) => { if (text !== lastNote) console.error(text); lastNote = text; };

const pausedNote = (summary) => {
  const hold = holdReport(cfg);
  return hold ? `broker: paused — ${holdLine(hold)}` : `broker: paused — ${summary.pausedRepos.join(', ')} holds hand edits (job ${summary.pausedOn} stays queued)`;
};

const drain = () => {
  heartbeat(cfg);
  if (recoveryReason) {
    recoverPending();
    if (recoveryReason) { note(`broker: ${recoveryReason}`); return { processed: [], paused: false }; }
  }
  announce(selfCheck(cfg, { heal: true }).entries, said);
  const moved = rerouteMisplaced(cfg);
  if (moved.length) console.error(`broker: moved ${moved.length} job(s) to their repo's own queue: ${moved.join(', ')}`);
  const summary = processOnce(cfg, { onResult: (r) => console.error(`  ${r.id} → ${r.status}`), coalesceMs: flags.once ? 0 : cfg.coalesceMs });
  if (summary.paused) note(summary.reason === 'manual' ? 'broker: paused by operator; `resume` to continue' : pausedNote(summary));
  else if (summary.waiting && summary.waiting.length) note(`broker: waiting — ${summary.waiting.join('; ')}`);
  else lastNote = '';
  if (summary.suite) console.error(`  suite ${summary.suite.sha.slice(0, 7)} → ${summary.suite.status}${summary.suite.filed ? ' (regression filed)' : ''}${summary.suite.pruned ? `; ${summary.suite.pruned}` : ''}`);
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
// it hands the lock to a fresh daemon started from `current` and exits. A newly published runtime
// triggers the same hand-over after a drain, so a job in progress finishes on its own runtime.
const runtimeGone = () => !existsSync(join(import.meta.dirname, 'gate.mjs'));
function restartFromCurrent(why = `runtime gone (${import.meta.dirname})`) {
  const cur = runtimeCurrent();
  releaseLock(cfg);
  const args = process.argv.slice(2).filter((a, i, all) => a !== '--root' && all[i - 1] !== '--root' && a !== '--log' && all[i - 1] !== '--log');
  if (cur) launchDaemon(join(cur, 'scripts', 'broker', 'broker.mjs'), root, args);
  console.error(`broker: ${why}; ${cur ? `restarted from ${cur}` : 'no published runtime to restart from'}`);
  process.exit(0);
}

const tick = () => {
  if (stopRequested(cfg)) { clearStop(cfg); stop('stop requested'); }
  if (runtimeGone()) restartFromCurrent();
  const { processed, coalescing } = drain();
  const swap = publishedSwap();
  if (swap) restartFromCurrent(`runtime ${runtimeTag()} superseded by published ${swap}`);
  if (processed.length || listQueue(cfg).length || isPaused(cfg)) lastWork = Date.now();
  if (idleMs && Date.now() - lastWork > idleMs) stop(`idle for ${flags['idle-exit']} min, exiting`);
  setTimeout(tick, coalescing ? Math.min(pollMs, coalescing) : pollMs);
};
tick();
