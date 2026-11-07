// build-slot.test.mjs — the machine-wide build budget (KIT-T622, KIT-D135): builds of different checkouts
// share one core budget and take turns instead of multiplying `cargo -j`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireBuildSlot } from './build-slot.mjs';
import { liveHolds } from './build-slot-store.mjs';
import { isCargoBuild } from './cargo-subs.mjs';

const PROBES = { physicalCores: () => 10, commitFreeBytes: () => Infinity, gameRunning: () => false };
const BUDGET = 8;
const CARGO = 'cargo test -p game';
const POLL = 20;

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'build-slot-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  try { return fn(dir); } finally { delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR; rmSync(dir, { recursive: true, force: true }); }
}

const polls = (n) => { let left = n; return () => left-- <= 0; };
const acquire = (cmd, extra = {}) => acquireBuildSlot(cmd, { jobs: BUDGET, probes: PROBES, pollMs: POLL, ...extra });
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

test('only cargo build-shaped commands take a slot', () => {
  assert.equal(isCargoBuild('cd rust && cargo test -p x'), true);
  assert.equal(isCargoBuild('cargo t --no-run'), true);
  assert.equal(isCargoBuild('cargo ndk -t arm64-v8a build'), true);
  assert.equal(isCargoBuild('cargo fmt --check'), false);
  assert.equal(isCargoBuild('node -e "console.log(1)"'), false);
});

test('a non-cargo command gets a no-op slot at once and leaves no files', () => withDir((dir) => {
  const s = acquire('node -e "0"');
  assert.deepEqual([s.cancelled, s.waitedMs], [false, 0]);
  s.release();
  assert.equal(existsSync(join(dir, 'queue')), false);
}));

test('a build asking for more than the budget is granted exactly the budget', () => withDir(() => {
  const s = acquire(CARGO, { jobs: 24 });
  assert.equal(s.granted, BUDGET);
  s.release();
}));

test('a second full-budget build waits for the first and runs once it releases', () => withDir((dir) => {
  const first = acquire(CARGO, { label: 'first' });
  const second = acquire(CARGO, { shouldCancel: polls(3) });
  assert.equal(second.cancelled, true, 'the budget is held, so the waiter gives up');
  assert.equal(readdirSync(join(dir, 'queue')).length, 0, 'a cancelled waiter leaves no ticket');
  first.release();
  const third = acquire(CARGO);
  assert.equal(third.cancelled, false);
  third.release();
  assert.deepEqual(liveHolds(dir), []);
}));

test('two half-budget builds run together and the third waits', () => withDir(() => {
  const a = acquire(CARGO, { jobs: 4 });
  const b = acquire(CARGO, { jobs: 4 });
  const c = acquire(CARGO, { jobs: 4, shouldCancel: polls(2) });
  assert.deepEqual([a.cancelled, b.cancelled, c.cancelled], [false, false, true]);
  a.release();
  b.release();
}));

test('an elastic build starts on the cores that are free and says how many', () => withDir(() => {
  const a = acquire(CARGO, { jobs: 4, label: 'a' });
  const b = acquire(CARGO, { jobs: 24, elastic: true });
  assert.deepEqual([a.granted, b.granted], [4, BUDGET - 4]);
  a.release();
  b.release();
}));

test('an elastic build waits when fewer than the minimum grant are free', () => withDir(() => {
  const a = acquire(CARGO, { jobs: BUDGET - 2 });
  const b = acquire(CARGO, { jobs: 24, elastic: true, shouldCancel: polls(2) });
  assert.equal(b.cancelled, true);
  a.release();
}));

test('arrival order: an older live ticket goes first even while cores are free', () => withDir((dir) => {
  const queue = join(dir, 'queue');
  mkdirSync(queue, { recursive: true });
  writeFileSync(join(queue, '000000000000001-older'), JSON.stringify({ pid: process.pid, host: hostname() }));
  const s = acquire(CARGO, { jobs: 1, shouldCancel: polls(3) });
  assert.equal(s.cancelled, true);
}));

test('a hold and a ticket left by a dead process are reclaimed', () => withDir((dir) => {
  const queue = join(dir, 'queue');
  mkdirSync(queue, { recursive: true });
  const ghost = JSON.stringify({ pid: deadPid(), host: hostname(), label: 'crashed', jobs: BUDGET });
  writeFileSync(join(dir, 'slot-000000000000001-ghost'), ghost);
  writeFileSync(join(queue, '000000000000001-ghost'), ghost);
  const s = acquire(CARGO);
  assert.equal(s.cancelled, false);
  s.release();
}));

test('a running game takes its cores off the budget', () => withDir(() => {
  const s = acquire(CARGO, { jobs: 24, probes: { ...PROBES, gameRunning: () => true } });
  assert.ok(s.granted < BUDGET, `granted ${s.granted} with a game running, budget ${BUDGET}`);
  s.release();
}));

test('across processes: a command queues behind another process\'s build and names the holder', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-slot-x-'));
  const src = `
    import { acquireBuildSlot } from ${JSON.stringify(new URL('./build-slot.mjs', import.meta.url).href)};
    const probes = { physicalCores: () => 10, commitFreeBytes: () => Infinity, gameRunning: () => false };
    const s = acquireBuildSlot('${CARGO}', { jobs: 8, label: 'stiletto build', probes });
    console.log('held');
    setTimeout(() => { s.release(); }, 1500);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', src], { env: { ...process.env, CLAUDE_KIT_BUILD_SLOT_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((resolve) => child.stdout.once('data', resolve));
    process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
    const s = acquire(CARGO);
    assert.ok(s.waitedMs >= 1000, `waited ${s.waitedMs} ms`);
    assert.equal(s.holder, 'stiletto build');
    s.release();
  } finally {
    delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR;
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
