// build-slot.mjs — the machine-wide build budget (KIT-D105, KIT-T622, KIT-D135). Every Rust build from every
// project, agent and tool takes cores from ONE budget: the physical cores minus the reserve (build-budget.mjs),
// less the cores a running game or UAT session keeps. Builds that do not fit queue in arrival order; only the head
// of the queue is admitted, so a large build is never starved by small ones. Holds and tickets live in one directory
// under the user's `.claude` shared by every checkout (build-slot-store.mjs).
//
//   acquireBuildSlot(cmd, { jobs, label, force, elastic, cwd, shouldCancel, probes, pollMs })
//     -> { cancelled, waitedMs, holder, granted, release() }
//   `jobs` is the cores the build asks for (clamped to the budget). `elastic` builds start on whatever is free once
//   MIN_ELASTIC_GRANT cores are, `granted` says how many they got; a fixed build (the broker's composed `-j`) waits for
//   all of `jobs`. `cmd` that is not cargo build-shaped (and not `force`) gets a no-op slot at once. While queued the
//   call beats the daemon's heartbeat (pulse) and polls `shouldCancel()`; `holder` names the hold it first waited on.
//   `probes` = { physicalCores, commitFreeBytes, gameRunning } replaces the OS readings (tests).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { isCargoBuild } from './cargo-subs.mjs';
import { grantFor } from './build-grant.mjs';
import { commitFreeBytes } from './build-probes.mjs';
import { SLOT_PREFIX, limits, liveHolds, liveTickets, queueDir, slotDir } from './build-slot-store.mjs';
import { pulse } from './stall.mjs';

export { slotDir };

const POLL_MS = 500;
const TICKET_WIDTH = 15;
const RADIX = 36;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const NO_SLOT = { cancelled: false, waitedMs: 0, holder: null, granted: 0, release() {} };

export function acquireBuildSlot(cmd, { jobs, label = String(cmd), force = false, elastic = false, cwd = process.cwd(), shouldCancel = () => false, probes = {}, pollMs = POLL_MS } = {}) {
  if (!force && !isCargoBuild(cmd)) return NO_SLOT;
  const dir = slotDir();
  const queue = queueDir(dir);
  mkdirSync(queue, { recursive: true });
  const record = { pid: process.pid, host: hostname(), label, cwd, jobs: Math.max(1, Number(jobs) || 1), ts: new Date().toISOString() };
  const name = `${Date.now().toString().padStart(TICKET_WIDTH, '0')}-${process.pid}-${Math.random().toString(RADIX).slice(2, 8)}`;
  const ticketPath = join(queue, name);
  writeFileSync(ticketPath, JSON.stringify({ ...record, elastic }));
  const started = Date.now();
  let holder = null;
  for (;;) {
    const { budget } = limits(probes);
    const head = liveTickets(queue)[0] === name;
    const holds = liveHolds(dir);
    if (head) {
      const free = probes.commitFreeBytes ? probes.commitFreeBytes() : holds.length ? commitFreeBytes() : null;
      const granted = grantFor({ requested: jobs, elastic, budget, held: holds, commitFreeBytes: free ?? Infinity });
      if (granted) return hold(dir, name, ticketPath, { ...record, jobs: granted }, started, holder);
    }
    if (shouldCancel()) { rmSync(ticketPath, { force: true }); return { ...NO_SLOT, cancelled: true, waitedMs: Date.now() - started }; }
    holder ??= holds[0]?.label ?? null;
    pulse();
    sleep(pollMs);
  }
}

function hold(dir, name, ticketPath, record, started, holder) {
  const path = join(dir, `${SLOT_PREFIX}${name}`);
  writeFileSync(path, JSON.stringify(record));
  rmSync(ticketPath, { force: true });
  return { cancelled: false, waitedMs: Date.now() - started, holder, granted: record.jobs, release() { rmSync(path, { force: true }); } };
}
