// build-backfill.test.mjs — a build behind a waiting one starts when it fits and the ones ahead do not, and the waiting one is
// never passed once it has waited BYPASS_MAX_MS (KIT-T1280).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { BYPASS_MAX_MS, mayStart } from './build-backfill.mjs';
import { acquireBuildSlot } from './build-slot.mjs';
import { queueDir } from './build-slot-store.mjs';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const ticket = (name) => `${String(NOW - name).padStart(15, '0')}-1-aaaaaa`;
const queueOf = (...entries) => entries.map(([age, fits]) => ({ name: ticket(age), fits }));

test('the head starts when it fits', () => {
  const queue = queueOf([5000, true], [1000, true]);
  assert.equal(mayStart({ name: queue[0].name, queue, now: NOW }), true);
  assert.equal(mayStart({ name: queue[1].name, queue, now: NOW }), false, 'the second waits for the head, which fits and starts first');
});

test('a small build passes a waiting large one when the cores are free', () => {
  const queue = queueOf([20000, false], [1000, true]);
  assert.equal(mayStart({ name: queue[1].name, queue, now: NOW }), true);
  assert.equal(mayStart({ name: queue[0].name, queue, now: NOW }), false, 'the large one does not fit yet');
});

test('only the first build that fits passes, so two waiters never start on the same cores', () => {
  const queue = queueOf([30000, false], [20000, true], [10000, true]);
  assert.deepEqual(queue.map((t) => mayStart({ name: t.name, queue, now: NOW })), [false, true, false]);
});

test('a build that fits nowhere never starts', () => {
  const queue = queueOf([2000, false], [1000, false]);
  assert.deepEqual(queue.map((t) => mayStart({ name: t.name, queue, now: NOW })), [false, false]);
});

test('the large build is passed only until it has waited BYPASS_MAX_MS, then the queue is strict', () => {
  const steps = [0, BYPASS_MAX_MS - 1, BYPASS_MAX_MS, BYPASS_MAX_MS + 1, 2 * BYPASS_MAX_MS];
  const passes = steps.map((age) => {
    const queue = queueOf([age, false], [1000, true]);
    return mayStart({ name: queue[1].name, queue, now: NOW });
  });
  assert.deepEqual(passes, [true, true, false, false, false]);
});

test('once the cores free up the aged large build starts and the small one waits behind it', () => {
  const queue = queueOf([2 * BYPASS_MAX_MS, true], [1000, true]);
  assert.equal(mayStart({ name: queue[0].name, queue, now: NOW }), true, 'the large build starts the moment it fits, passed or not');
  assert.equal(mayStart({ name: queue[1].name, queue, now: NOW }), false);
});

const PROBES = { physicalCores: () => 10, commitFreeBytes: () => Infinity, gameRunning: () => false };
const BUDGET = 8;
const CARGO = 'cargo test -p game';
const POLL = 20;
const WAITING_POLLS = 3;
const polls = (n) => { let left = n; return () => left-- <= 0; };
const acquire = (extra) => acquireBuildSlot(CARGO, { probes: PROBES, pollMs: POLL, ...extra });

function withQueue(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'build-backfill-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  mkdirSync(queueDir(dir), { recursive: true });
  const waitingLarge = (ageMs) => {
    const name = `${String(Date.now() - ageMs).padStart(15, '0')}-${process.pid}-large`;
    writeFileSync(join(queueDir(dir), name), JSON.stringify({ pid: process.pid, host: hostname(), label: 'large', cwd: dir, jobs: BUDGET, elastic: false, ts: new Date().toISOString() }));
  };
  try { return fn(waitingLarge); } finally { delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR; rmSync(dir, { recursive: true, force: true }); }
}

test('acquireBuildSlot: a 2-core build starts beside a running one while a full-budget build waits ahead of it', () => withQueue((waitingLarge) => {
  const running = acquire({ jobs: 4, label: 'running' });
  waitingLarge(1000);
  const small = acquire({ jobs: 2, label: 'small', shouldCancel: polls(WAITING_POLLS) });
  assert.equal(small.cancelled, false);
  assert.equal(small.granted, 2);
  small.release();
  running.release();
}));

test('acquireBuildSlot: once the large build has waited BYPASS_MAX_MS the small one waits behind it', () => withQueue((waitingLarge) => {
  const running = acquire({ jobs: 4, label: 'running' });
  waitingLarge(BYPASS_MAX_MS + 1000);
  const small = acquire({ jobs: 2, label: 'small', shouldCancel: polls(WAITING_POLLS) });
  assert.equal(small.cancelled, true);
  running.release();
}));
