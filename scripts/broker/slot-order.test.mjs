// slot-order.test.mjs — a lane that holds a submodule tree another lane of its checkout waits for takes cores first
// (KIT-T1044), so a long hold is not stretched by queueing behind builds that cannot start without that tree. Controls:
// no waiting lane means arrival order; another checkout's earlier ticket is never passed; a stale or own-lane want
// gives no priority.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireBuildSlot } from './build-slot.mjs';
import { liveTickets, queueDir } from './build-slot-store.mjs';
import { orderTickets } from './slot-order.mjs';
import { setSlotPriority } from './slot-priority.mjs';
import { heldTreeWanted } from './subtree.mjs';

const PROBES = { physicalCores: () => 10, commitFreeBytes: () => Infinity, gameRunning: () => false };
const BUDGET = 8;
const STALE_MS = 120000;

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'slot-order-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  try { return fn(dir); } finally { setSlotPriority(null); delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR; rmSync(dir, { recursive: true, force: true }); }
}

const ticket = (queue, name, extra = {}) => writeFileSync(join(queue, name), JSON.stringify({ pid: process.pid, host: hostname(), label: name, cwd: '.', jobs: BUDGET, ...extra }));

test('orderTickets keeps arrival order when nothing is priority', () => {
  const names = orderTickets([{ name: '3', group: 'A' }, { name: '1', group: 'A' }, { name: '2', group: 'B' }]);
  assert.deepEqual(names, ['1', '2', '3']);
});

test('a priority ticket goes ahead of its own checkout earlier tickets', () => {
  const names = orderTickets([{ name: '1', group: 'A' }, { name: '2', group: 'A' }, { name: '3', group: 'A', priority: true }]);
  assert.deepEqual(names, ['3', '1', '2']);
});

test('control: a priority ticket never passes another checkout earlier ticket', () => {
  const names = orderTickets([{ name: '1', group: 'B' }, { name: '2', group: 'A' }, { name: '3', group: 'A', priority: true }]);
  assert.deepEqual(names, ['1', '3', '2']);
});

test('control: a priority flag without a checkout group moves nothing', () => {
  assert.deepEqual(orderTickets([{ name: '1' }, { name: '2', priority: true }]), ['1', '2']);
});

test('liveTickets reads the groups from the ticket files', () => withDir((dir) => {
  const queue = queueDir(dir);
  mkdirSync(queue, { recursive: true });
  ticket(queue, '001-rapid-game', { group: 'game' });
  ticket(queue, '002-other-project', { group: 'tool' });
  ticket(queue, '003-root-train', { group: 'game', priority: true });
  assert.deepEqual(liveTickets(queue), ['003-root-train', '001-rapid-game', '002-other-project']);
}));

test('a build waiting on a tree another lane wants is re-marked priority while it queues', () => withDir((dir) => {
  const queue = queueDir(dir);
  mkdirSync(queue, { recursive: true });
  writeFileSync(join(dir, 'slot-000-holder'), JSON.stringify({ pid: process.pid, host: hostname(), label: 'holder', cwd: '.', jobs: BUDGET, ts: new Date().toISOString() }));
  ticket(queue, '001-rapid-game', { group: 'game' });
  let wanted = false;
  setSlotPriority({ group: 'game', wanted: () => wanted });
  const seen = [];
  const shouldCancel = () => {
    const mine = liveTickets(queue).find((n) => n !== '001-rapid-game');
    seen.push({ first: liveTickets(queue)[0] === mine, priority: !!JSON.parse(readFileSync(join(queue, mine), 'utf8')).priority });
    wanted = true;
    return seen.length >= 2;
  };
  const slot = acquireBuildSlot('cargo test -p game', { jobs: BUDGET, probes: PROBES, pollMs: 10, shouldCancel });
  assert.equal(slot.cancelled, true);
  assert.deepEqual(seen, [{ first: false, priority: false }, { first: true, priority: true }]);
}));

test('heldTreeWanted: a fresh want from another lane on a tree this process holds', () => {
  const targetDir = mkdtempSync(join(tmpdir(), 'tree-want-'));
  try {
    const home = join(targetDir, 'broker', 'subtree');
    mkdirSync(home, { recursive: true });
    const cfg = { targetDir, lane: null };
    const want = (lane) => join(home, `rapid-game.want.${lane}`);
    writeFileSync(join(home, 'rapid-game.lock'), JSON.stringify({ lane: 'root', pid: process.pid, host: hostname() }));
    assert.equal(heldTreeWanted(cfg), false, 'control: nobody waits');
    writeFileSync(want('root'), '');
    assert.equal(heldTreeWanted(cfg), false, 'control: the holder own want is not another lane');
    writeFileSync(want('rapid-game'), '');
    assert.equal(heldTreeWanted(cfg), true);
    const old = new Date(Date.now() - STALE_MS);
    utimesSync(want('rapid-game'), old, old);
    assert.equal(heldTreeWanted(cfg), false, 'control: a stale want gives no priority');
    writeFileSync(want('rapid-game'), '');
    writeFileSync(join(home, 'rapid-game.lock'), JSON.stringify({ lane: 'root', pid: process.pid + 1, host: hostname() }));
    assert.equal(heldTreeWanted(cfg), false, 'control: a tree another process holds is not this daemon to speed up');
  } finally { rmSync(targetDir, { recursive: true, force: true }); }
});
