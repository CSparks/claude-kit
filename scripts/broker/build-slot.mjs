// build-slot.mjs — the machine-wide build budget (KIT-D105, KIT-T622, KIT-D135). Every Rust build from every
// project, agent and tool takes cores from ONE budget: the physical cores minus the reserve (build-budget.mjs),
// less the cores a running game or UAT session keeps. Builds that do not fit queue in arrival order; only the head
// of the queue is admitted, so a large build is never starved by small ones; a hold past the 5-minute ceiling lets one
// small slice start beside it (build-grant.mjs). A broker daemon that holds a tree another lane of its checkout waits
// for marks its tickets `priority`, and they go ahead of that checkout's earlier ones (slot-order.mjs, KIT-T1044). A hold's `ts` is when it began. Holds and tickets live in one directory
// under the user's `.claude` shared by every checkout (build-slot-store.mjs).
//
//   acquireBuildSlot(cmd, { jobs, label, force, elastic, cwd, shouldCancel, probes, pollMs })
//     -> { cancelled, waitedMs, holder, granted, update(patch), release() }
//   `update(patch)` rewrites the live hold's record (build-phase.mjs shrinks it to a run-phase charge); the hold keeps
//   `full` (the grant) and `by` (who started it, build-origin.mjs).
//   `jobs` is the cores the build asks for (clamped to the budget). `elastic` builds start on whatever is free once
//   MIN_ELASTIC_GRANT cores are, `granted` says how many they got; a fixed build (the broker's composed `-j`) waits for
//   all of `jobs`. `cmd` that is not cargo build-shaped (and not `force`) gets a no-op slot at once. While queued the
//   call beats the daemon's heartbeat (pulse) and polls `shouldCancel()`; `holder` names the hold it first waited on.
//   `probes` = { physicalCores, commitFreeBytes, gameRunning } replaces the OS readings (tests).
//   `meta` = extra fields for the record: `scope` (absolute paths the build compiles), `scopeVia` (path -> dependency chain),
//   `scopeReason` (why a scope is wide) and `writer` (the agent that started it); a write by another agent into the scope while the hold compiles is refused (hooks/lib/build-write-hold.mjs).
//   `beforeStart()` runs once the cores are granted and before the hold is written (the build-start wait of write-window.mjs).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { isCargoBuild } from './cargo-subs.mjs';
import { grantFor } from './build-grant.mjs';
import { commitFreeBytes } from './build-probes.mjs';
import { SLOT_PREFIX, limits, liveHolds, liveTickets, queueDir, rewriteHold, slotDir } from './build-slot-store.mjs';
import { startedBy } from './build-origin.mjs';
import { slotPriority } from './slot-priority.mjs';
import { pulse } from './stall.mjs';

export { slotDir };

const POLL_MS = 500;
const TICKET_WIDTH = 15;
const RADIX = 36;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const NO_SLOT = { cancelled: false, waitedMs: 0, holder: null, granted: 0, update() {}, release() {} };

export function acquireBuildSlot(cmd, { jobs, label = String(cmd), force = false, elastic = false, cwd = process.cwd(), shouldCancel = () => false, probes = {}, pollMs = POLL_MS, meta = {}, beforeStart = () => {} } = {}) {
  if (!force && !isCargoBuild(cmd)) return NO_SLOT;
  const dir = slotDir();
  const queue = queueDir(dir);
  mkdirSync(queue, { recursive: true });
  const record = { ...meta, pid: process.pid, host: hostname(), label, cwd, jobs: Math.max(1, Number(jobs) || 1), ts: new Date().toISOString() };
  const name = `${Date.now().toString().padStart(TICKET_WIDTH, '0')}-${process.pid}-${Math.random().toString(RADIX).slice(2, 8)}`;
  const ticketPath = join(queue, name);
  const ticket = { ...record, elastic, ...(slotPriority() || {}) };
  writeFileSync(ticketPath, JSON.stringify(ticket));
  const started = Date.now();
  let holder = null;
  for (;;) {
    const now = slotPriority();
    if (now && now.priority !== !!ticket.priority) writeFileSync(ticketPath, JSON.stringify(Object.assign(ticket, now)));
    const { budget } = limits(probes);
    const head = liveTickets(queue)[0] === name;
    const holds = liveHolds(dir);
    if (head) {
      const free = probes.commitFreeBytes ? probes.commitFreeBytes() : holds.length ? commitFreeBytes() : null;
      const granted = grantFor({ requested: jobs, elastic, budget, held: holds, commitFreeBytes: free ?? Infinity });
      if (granted) {
        beforeStart();
        return hold(dir, name, ticketPath, { ...record, jobs: granted }, started, holder);
      }
    }
    if (shouldCancel()) { rmSync(ticketPath, { force: true }); return { ...NO_SLOT, cancelled: true, waitedMs: Date.now() - started }; }
    holder ??= holds[0]?.label ?? null;
    pulse();
    sleep(pollMs);
  }
}

function hold(dir, name, ticketPath, record, started, holder) {
  const path = join(dir, `${SLOT_PREFIX}${name}`);
  let current = { ...record, ts: new Date().toISOString(), full: record.jobs, by: startedBy() };
  writeFileSync(path, JSON.stringify(current));
  rmSync(ticketPath, { force: true });
  let released = false;
  return {
    cancelled: false, waitedMs: Date.now() - started, holder, granted: record.jobs,
    update(patch) { if (!released) { current = { ...current, ...patch }; rewriteHold(path, current); } },
    release() { released = true; rmSync(path, { force: true }); },
  };
}
