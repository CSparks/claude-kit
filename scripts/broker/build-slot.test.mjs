// build-slot.test.mjs — the machine-wide build slots (KIT-T622): brokers of different checkouts take
// turns on the machine instead of multiplying `cargo -j`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireBuildSlot, slotCount } from './build-slot.mjs';
import { isCargoBuild } from './cargo-subs.mjs';

const GIB = 2 ** 30;
const MACHINE = { cores: 8, memBytes: 32 * GIB };
const CARGO = 'cargo test -p game';
const POLL = 20;

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'build-slot-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  try { return fn(dir); } finally { delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR; rmSync(dir, { recursive: true, force: true }); }
}

const polls = (n) => { let left = n; return () => left-- <= 0; };
const acquire = (cmd, extra = {}) => acquireBuildSlot(cmd, { jobs: 8, machine: MACHINE, pollMs: POLL, ...extra });
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

test('slotCount: one slot where -j already fills the machine, more where jobs are pinned low', () => {
  assert.equal(slotCount(8, MACHINE), 1);
  assert.equal(slotCount(4, MACHINE), 2);
  assert.equal(slotCount(100, MACHINE), 1);
  assert.equal(slotCount(undefined, MACHINE), 8);
});

test('only cargo build-shaped commands take a slot', () => {
  assert.equal(isCargoBuild('cd rust && cargo test -p x'), true);
  assert.equal(isCargoBuild('cargo t --no-run'), true);
  assert.equal(isCargoBuild('cargo fmt --check'), false);
  assert.equal(isCargoBuild('node -e "console.log(1)"'), false);
});

test('a non-cargo command gets a no-op slot at once and leaves no files', () => withDir((dir) => {
  const s = acquire('node -e "0"');
  assert.deepEqual([s.cancelled, s.waitedMs], [false, 0]);
  s.release();
  assert.equal(existsSync(join(dir, 'queue')), false);
}));

test('a second cargo command waits for the first and runs once it releases', () => withDir((dir) => {
  const first = acquire(CARGO, { label: 'first' });
  const second = acquire(CARGO, { shouldCancel: polls(3) });
  assert.equal(second.cancelled, true, 'the slot is held, so the waiter gives up');
  assert.equal(readdirSync(join(dir, 'queue')).length, 1, 'a cancelled waiter leaves no ticket');
  first.release();
  const third = acquire(CARGO);
  assert.equal(third.cancelled, false);
  third.release();
  assert.deepEqual(readdirSync(join(dir, 'queue')), []);
}));

test('two slots admit two commands and hold back the third', () => withDir(() => {
  const a = acquire(CARGO, { jobs: 4 });
  const b = acquire(CARGO, { jobs: 4 });
  const c = acquire(CARGO, { jobs: 4, shouldCancel: polls(2) });
  assert.deepEqual([a.cancelled, b.cancelled, c.cancelled], [false, false, true]);
  a.release();
  b.release();
}));

test('arrival order: an older live ticket goes first even while a slot is free', () => withDir((dir) => {
  const queue = join(dir, 'queue');
  mkdirSync(queue, { recursive: true });
  writeFileSync(join(queue, '000000000000001-older'), JSON.stringify({ pid: process.pid, host: hostname() }));
  const s = acquire(CARGO, { shouldCancel: polls(3) });
  assert.equal(s.cancelled, true);
}));

test('a slot and a ticket left by a dead process are reclaimed', () => withDir((dir) => {
  const queue = join(dir, 'queue');
  mkdirSync(queue, { recursive: true });
  const ghost = JSON.stringify({ pid: deadPid(), host: hostname(), label: 'crashed' });
  writeFileSync(join(dir, 'slot-0'), ghost);
  writeFileSync(join(queue, '000000000000001-ghost'), ghost);
  const s = acquire(CARGO);
  assert.equal(s.cancelled, false);
  s.release();
}));

test('across processes: a command queues behind another process\'s build and names the holder', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-slot-x-'));
  const src = `
    import { acquireBuildSlot } from ${JSON.stringify(new URL('./build-slot.mjs', import.meta.url).href)};
    const s = acquireBuildSlot('${CARGO}', { jobs: 8, label: 'stiletto build', machine: { cores: 8, memBytes: ${MACHINE.memBytes} } });
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
