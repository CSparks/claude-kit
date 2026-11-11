// build-phase.test.mjs — a hold shrinks to the tests' CPU once a build stops compiling, grows back when a compiler
// reappears, and `builds` shows what each holder is doing (KIT-T1056).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireBuildSlot } from './build-slot.mjs';
import { liveHolds, snapshot } from './build-slot-store.mjs';
import { RUN_MIN_CORES, SETTLE_MS, chargeFor, phaseWatch, readPhase } from './build-phase.mjs';
import { startedBy } from './build-origin.mjs';
import { describeHolder, formatSnapshot } from './build-status.mjs';

const GRANTED = 14;
const POLL = 5000;
const START = 1_000_000;
const ROOT = 100;
const cargo = { pid: ROOT, ppid: 1, name: 'cargo.exe', cpuMs: 0 };
const rustc = (cpuMs = 0) => ({ pid: 201, ppid: ROOT, name: 'rustc.exe', cpuMs });
const testBinary = (cpuMs) => ({ pid: 300, ppid: ROOT, name: 'app-0e55.exe', cpuMs });

function fakeSlot() {
  const updates = [];
  return { granted: GRANTED, updates, update: (patch) => updates.push(patch), last: () => updates[updates.length - 1] };
}

function drive(frames) {
  const slot = fakeSlot();
  let at = START;
  let rows = [];
  const watch = phaseWatch({ slot, pid: ROOT, list: () => rows, now: () => at, pollMs: POLL, settleMs: SETTLE_MS });
  for (const frame of frames) { rows = frame; watch.poll(); at += POLL; }
  return slot;
}

const testing = (perPollCpuMs, polls) => Array.from({ length: polls }, (_, i) => [cargo, testBinary(i * perPollCpuMs)]);

test('readPhase: rustc and linkers are compiling, a test binary is testing, cargo alone is neither', () => {
  assert.deepEqual(readPhase([cargo, rustc(5)]), { compiling: true, rustc: 1, testing: false, cpuMs: 5 });
  assert.equal(readPhase([cargo, testBinary(7)]).testing, true);
  assert.equal(readPhase([cargo]).testing, false);
  assert.equal(readPhase([cargo, { pid: 9, ppid: ROOT, name: 'build_script_build-ab12.exe', cpuMs: 0 }]).compiling, true);
});

test('chargeFor: measured cores rounded up, never under the floor, never over the grant', () => {
  assert.equal(chargeFor(1.9, GRANTED), RUN_MIN_CORES);
  assert.equal(chargeFor(0.1, GRANTED), RUN_MIN_CORES);
  assert.equal(chargeFor(5.2, GRANTED), 6);
  assert.equal(chargeFor(40, GRANTED), GRANTED);
});

test('a test run at about 1.9 cores shrinks the hold to the 2-core floor after the settle time', () => {
  const slot = drive(testing(9500, 4));
  assert.equal(slot.last().phase, 'running');
  assert.equal(slot.last().jobs, RUN_MIN_CORES);
  assert.equal(slot.last().rustc, 0);
  assert.ok(Math.abs(slot.last().cores - 1.9) < 0.01);
});

test('a test run using 9 cores is charged 9', () => {
  assert.equal(drive(testing(45000, 4)).last().jobs, 9);
});

test('control: a compiling job never shrinks, however little CPU it shows', () => {
  const slot = drive(Array.from({ length: 8 }, () => [cargo, rustc(10)]));
  assert.ok(slot.updates.length > 0);
  assert.ok(slot.updates.every((u) => u.phase === 'compiling' && u.jobs === GRANTED && u.rustc === 1));
});

test('control: a job that has not settled is not shrunk (a test binary seen for under the settle time)', () => {
  assert.equal(drive(testing(9500, 2)).updates.length, 0);
});

test('control: cargo with no compiler and no test process (starting up) changes nothing', () => {
  assert.equal(drive(Array.from({ length: 6 }, () => [cargo])).updates.length, 0);
});

test('a compiler that reappears grows the shrunk hold back to the grant', () => {
  const slot = drive([...testing(9500, 4), [cargo, rustc(0)]]);
  const phases = slot.updates.map((u) => [u.phase, u.jobs]);
  assert.deepEqual(phases[phases.length - 2], ['running', RUN_MIN_CORES]);
  assert.deepEqual(phases[phases.length - 1], ['compiling', GRANTED]);
});

function withSlotDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'build-phase-'));
  const saved = [process.env.CLAUDE_KIT_BUILD_SLOT_DIR, process.env.CLAUDE_KIT_BUILD_BUDGET_FILE];
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  process.env.CLAUDE_KIT_BUILD_BUDGET_FILE = join(dir, 'no-budget.json');
  try { return fn(dir); } finally {
    for (const [i, key] of ['CLAUDE_KIT_BUILD_SLOT_DIR', 'CLAUDE_KIT_BUILD_BUDGET_FILE'].entries()) {
      if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i];
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

const PROBES = { physicalCores: () => 16, commitFreeBytes: () => Infinity, gameRunning: () => false };

test('a shrunk hold frees its cores to a waiting build, and a released hold is not recreated', () => withSlotDir(() => {
  const big = acquireBuildSlot('cargo test', { jobs: GRANTED, probes: PROBES, label: 'D:\\dev\\dirt-empire: cargo test' });
  assert.equal(big.granted, GRANTED);
  const blocked = acquireBuildSlot('cargo test', { jobs: GRANTED, elastic: true, probes: PROBES, pollMs: 10, shouldCancel: () => true });
  assert.equal(blocked.cancelled, true, 'a full hold leaves the next build waiting');
  big.update({ phase: 'running', jobs: RUN_MIN_CORES, rustc: 0, cpuMs: 1351000, cores: 1.9 });
  const next = acquireBuildSlot('cargo test', { jobs: GRANTED, elastic: true, probes: PROBES, pollMs: 10, shouldCancel: () => true });
  assert.equal(next.granted, GRANTED - RUN_MIN_CORES, 'the rest of the budget is granted');
  assert.equal(liveHolds().find((h) => h.label.includes('dirt-empire')).full, GRANTED);
  next.release();
  big.release();
  big.update({ jobs: 99 });
  assert.equal(liveHolds().length, 0);
}));

test('the readout shows phase, rustc, CPU against charge, who started it, the root and the minutes, and marks a holder past 5 minutes', () => withSlotDir(() => {
  const long = new Date(Date.now() - 12 * 60000).toISOString();
  const hold = { pid: 59348, jobs: RUN_MIN_CORES, full: GRANTED, ts: long, cwd: 'D:\\dev\\dirt-empire', label: 'D:\\dev\\dirt-empire: cargo test -p dirt-empire', phase: 'running', rustc: 0, cpuMs: 1351000, cores: 1.9, by: 'broker daemon (a submitted job or its own suite; see broker status)' };
  const text = formatSnapshot({ physical: 16, reserve: 2, full: 14, budget: 14, game: false, holds: [hold], waiting: [] });
  assert.match(text, /running tests, 0 rustc \(charged 2 of 14, using 1\.9 now, live cpu 1351s\)/);
  assert.match(text, /started by broker daemon/);
  assert.match(text, /root D:\\dev\\dirt-empire/);
  assert.match(text, /held 12 min; PAST THE 5-MINUTE CEILING/);
  assert.match(describeHolder(hold), /for \d+s, root D:\\dev\\dirt-empire, job cargo test -p dirt-empire, running tests, 0 rustc/);
  const young = formatSnapshot({ physical: 16, reserve: 2, full: 14, budget: 14, game: false, holds: [{ ...hold, ts: new Date().toISOString(), phase: 'compiling', rustc: 6, jobs: GRANTED }], waiting: [] });
  assert.match(young, /compiling, 6 rustc \(charged 14 of 14/);
  assert.doesNotMatch(young, /PAST THE 5-MINUTE/);
}));

test('startedBy: the broker daemon, a session id, or neither', () => {
  assert.match(startedBy({}, 'D:\\kit\\scripts\\broker\\broker.mjs'), /^broker daemon/);
  assert.equal(startedBy({ CLAUDE_CODE_SESSION_ID: '5b63523a-1111' }, 'build-run.mjs'), 'session 5b63523a');
  assert.match(startedBy({}, 'build-run.mjs'), /no session id/);
  assert.equal(startedBy({ CLAUDE_KIT_HOLD_BY: 'x' }, 'build-run.mjs'), 'x');
});

test('a granted hold records who started it and its full grant', () => withSlotDir((dir) => {
  const s = acquireBuildSlot('cargo test', { jobs: 6, probes: PROBES, label: 'x' });
  const rec = JSON.parse(readFileSync(join(dir, readHoldName(dir)), 'utf8'));
  assert.equal(rec.full, 6);
  assert.equal(typeof rec.by, 'string');
  assert.equal(snapshot(PROBES).holds.length, 1);
  s.release();
}));

function readHoldName(dir) {
  return liveHolds(dir)[0].name;
}
