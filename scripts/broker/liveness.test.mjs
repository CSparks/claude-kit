// liveness.test.mjs — wait never advises starting a daemon while one is alive, and auto-start never
// starts a second one (KIT-T322): a live lock pid or a fresh heartbeat is a live broker, a dead pid
// warns only after the restart grace, concurrent auto-starts yield one spawn, and two real daemons
// racing for the lock leave exactly one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { ensureBroker, noBrokerWarning, NO_BROKER_GRACE_MS } from './ensure.mjs';
import { heartbeat, liveHolder, observedLive } from './lock.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;
const putLock = (s, { pid, host = hostname() }) => { ensureDirs(s.cfg); writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid, host, ts: new Date().toISOString() })); };
const queue = (s) => writeJob(s.cfg, { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [] }).id;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

test('a live lock pid gives no warning, however long the wait; a dead pid warns once the grace has passed', () => {
  const s = fixture();
  try {
    const id = queue(s);
    putLock(s, { pid: process.pid });
    assert.equal(noBrokerWarning(s.cfg, id, { missingForMs: 10 * NO_BROKER_GRACE_MS }), null);
    putLock(s, { pid: deadPid() });
    assert.match(noBrokerWarning(s.cfg, id, { missingForMs: NO_BROKER_GRACE_MS }), /no broker running/);
    assert.equal(noBrokerWarning(s.cfg, id, { missingForMs: 500 }), null, 'a restart gap shorter than the grace is not reported');
  } finally { s.done(); }
});

test('a lock written on another host counts as live, and a fresh heartbeat covers a pid this process cannot probe', () => {
  const s = fixture();
  try {
    putLock(s, { pid: deadPid(), host: 'SOME-OTHER-HOST' });
    assert.ok(liveHolder(s.cfg), 'cross-host: fail safe, treated as live');
    putLock(s, { pid: deadPid() });
    assert.equal(liveHolder(s.cfg), null);
    assert.equal(observedLive(s.cfg), null, 'dead pid, no heartbeat');
    heartbeat(s.cfg);
    assert.ok(observedLive(s.cfg), 'dead pid but a heartbeat from the last minute');
    const old = new Date(Date.now() - 5 * 60_000);
    utimesSync(brokerPaths(s.cfg).beat, old, old);
    assert.equal(observedLive(s.cfg), null, 'a stale heartbeat is not liveness');
  } finally { s.done(); }
});

test('two concurrent auto-starts spawn one daemon; a stale claim is taken over; a live lock spawns none', () => {
  const s = fixture();
  try {
    const calls = [];
    assert.equal(ensureBroker(s.cfg, s.root, () => calls.push('a')), true);
    assert.equal(ensureBroker(s.cfg, s.root, () => calls.push('b')), false, 'the second caller sees the first one starting');
    assert.deepEqual(calls, ['a']);
    const old = new Date(Date.now() - 5 * 60_000);
    utimesSync(brokerPaths(s.cfg).spawning, old, old);
    assert.equal(ensureBroker(s.cfg, s.root, () => calls.push('c')), true, 'a daemon that never came up does not block auto-start forever');
    putLock(s, { pid: process.pid });
    assert.equal(ensureBroker(s.cfg, s.root, () => calls.push('d')), false);
    assert.deepEqual(calls, ['a', 'c']);
  } finally { s.done(); }
});

test('two real daemons started together leave exactly one holding the lock', async () => {
  const s = fixture();
  const kids = [];
  try {
    mkdirSync(brokerPaths(s.cfg).home, { recursive: true });
    for (let i = 0; i < 2; i++) kids.push(spawn(process.execPath, [BROKER, '--root', s.root, '--idle-exit', '5'], { stdio: 'ignore', windowsHide: true }));
    await new Promise((r) => setTimeout(r, 3000));
    assert.equal(kids.filter((k) => alive(k.pid)).length, 1, 'the loser exited');
    assert.ok(kids.some((k) => liveHolder(s.cfg)?.pid === k.pid));
  } finally {
    for (const k of kids) { try { process.kill(k.pid); } catch { /* gone */ } }
    s.done();
  }
});
