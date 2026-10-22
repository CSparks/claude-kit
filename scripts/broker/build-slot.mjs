// build-slot.mjs — machine-wide build slots (KIT-D105, KIT-T622). Each broker sizes `cargo -j` for the whole
// machine (jobs.mjs), so brokers of different checkouts running at once multiply that: a dirt-empire
// test job linking 8 executables took 167-221 s beside a long stiletto build and 10-20 s with the
// machine to itself, and a gate hook died with a V8 abort at a 7 MB heap when the pagefile ran out.
// Every cargo build-shaped broker command therefore takes a slot first. The machine has
// floor(auto jobs / this command's jobs) slots (one on a box where `-j` already fills it), granted
// in arrival order, shared by every checkout through one directory under the user's `.claude`.
//
//   acquireBuildSlot(cmd, { jobs, label, force, shouldCancel, machine, pollMs })
//     -> { cancelled, waitedMs, holder, release() }
//   `cmd` that is not cargo build-shaped (and not `force`) gets a no-op slot at once. While queued the
//   call beats the daemon's heartbeat (pulse) and polls `shouldCancel()`; `holder` names the slot
//   owner it first waited on. CLAUDE_KIT_BUILD_SLOT_DIR moves the directory (tests).

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, hostname, availableParallelism, totalmem } from 'node:os';
import { join } from 'node:path';
import { autoJobs } from './jobs.mjs';
import { isCargoBuild } from './cargo-subs.mjs';
import { pulse } from './stall.mjs';

const POLL_MS = 500;
const TICKET_WIDTH = 15;
const RADIX = 36;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export const slotDir = () => process.env.CLAUDE_KIT_BUILD_SLOT_DIR || join(homedir(), '.claude', 'claude-kit-build-slots');

export const slotCount = (jobs, machine = { cores: availableParallelism(), memBytes: totalmem() }) => Math.max(1, Math.floor(autoJobs(machine) / Math.max(1, Number(jobs) || 1)));

const alive = (rec) => {
  if (!rec || rec.host !== hostname() || !Number.isInteger(rec.pid)) return false;
  try { process.kill(rec.pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
};

const readRec = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };

// Tickets in arrival order; a ticket whose process is gone is dropped.
function liveTickets(queue) {
  const names = [];
  for (const name of readdirSync(queue).sort()) {
    if (alive(readRec(join(queue, name)))) names.push(name);
    else rmSync(join(queue, name), { force: true });
  }
  return names;
}

function takeSlot(dir, count, record) {
  for (let i = 0; i < count; i++) {
    const path = join(dir, `slot-${i}`);
    for (let attempt = 0; attempt < 2; attempt++) {
      try { writeFileSync(path, JSON.stringify(record), { flag: 'wx' }); return path; } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (alive(readRec(path))) break;
        rmSync(path, { force: true });
      }
    }
  }
  return null;
}

const NO_SLOT = { cancelled: false, waitedMs: 0, holder: null, release() {} };

export function acquireBuildSlot(cmd, { jobs, label = String(cmd), force = false, shouldCancel = () => false, machine, pollMs = POLL_MS } = {}) {
  if (!force && !isCargoBuild(cmd)) return NO_SLOT;
  const dir = slotDir();
  const queue = join(dir, 'queue');
  mkdirSync(queue, { recursive: true });
  const record = { pid: process.pid, host: hostname(), label, ts: new Date().toISOString() };
  const ticket = `${Date.now().toString().padStart(TICKET_WIDTH, '0')}-${process.pid}-${Math.random().toString(RADIX).slice(2, 8)}`;
  writeFileSync(join(queue, ticket), JSON.stringify(record));
  const count = slotCount(jobs, machine);
  const started = Date.now();
  let holder = null;
  for (;;) {
    const mine = liveTickets(queue).indexOf(ticket);
    const path = mine !== -1 && mine < count ? takeSlot(dir, count, record) : null;
    if (path) {
      return { cancelled: false, waitedMs: Date.now() - started, holder, release() { rmSync(path, { force: true }); rmSync(join(queue, ticket), { force: true }); } };
    }
    if (shouldCancel()) { rmSync(join(queue, ticket), { force: true }); return { ...NO_SLOT, cancelled: true, waitedMs: Date.now() - started }; }
    holder ??= readRec(join(dir, 'slot-0'))?.label ?? null;
    pulse();
    sleep(pollMs);
  }
}
