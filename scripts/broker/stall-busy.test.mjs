// stall-busy.test.mjs — a daemon whose command child is alive and still writing its log is busy, not wedged,
// so a poller never kills it; a kill resets the beat so the replacement is not killed again before its first
// poll; a daemon that takes the lock beats at once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { acquireLock, heartbeat } from './lock.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { RESTART_MS, STALL_MS, activeChild, restartIfWedged, stallState } from './stall.mjs';
import { fixture } from './patchkit.mjs';

const ageFile = (file, ms) => { const t = new Date(Date.now() - ms); utimesSync(file, t, t); };
const holdLock = (s) => writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));

function stalledWithChild(logAgeMs) {
  const s = fixture();
  ensureDirs(s.cfg);
  holdLock(s);
  heartbeat(s.cfg);
  writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });
  ageFile(brokerPaths(s.cfg).beat, RESTART_MS + 30_000);
  const log = join(brokerPaths(s.cfg).logs, 'j-1-a-0.log');
  writeFileSync(log, 'compiling\n');
  ageFile(log, logAgeMs);
  writeFileSync(join(brokerPaths(s.cfg).home, 'children.json'), JSON.stringify([{ pid: process.pid, daemon: process.pid, host: hostname(), logPath: log, cmd: 'cargo test' }]));
  return s;
}

test('a stale beat with a live child still writing its log is not killed', () => {
  const s = stalledWithChild(1000);
  try {
    assert.ok(activeChild(s.cfg));
    const killed = [];
    assert.equal(restartIfWedged(s.cfg, s.root, { kill: (pid) => killed.push(pid), spawner: () => {} }), false);
    assert.deepEqual(killed, []);
  } finally { s.done(); }
});

test('negative control: the same stall with a log quiet past STALL_MS is killed, and the kill resets the beat', () => {
  const s = stalledWithChild(STALL_MS + 30_000);
  try {
    assert.equal(activeChild(s.cfg), null);
    const killed = [];
    assert.equal(restartIfWedged(s.cfg, s.root, { kill: (pid) => killed.push(pid), spawner: () => {} }), true);
    assert.deepEqual(killed, [process.pid]);
    assert.ok(Date.now() - statSync(brokerPaths(s.cfg).beat).mtimeMs < 5000, 'beat reset by the kill');
    holdLock(s);
    assert.equal(stallState(s.cfg), null, 'a replacement reads as fresh until it beats itself');
  } finally { s.done(); }
});

test('taking the lock beats at once, over an old beat file', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeFileSync(brokerPaths(s.cfg).beat, 'old');
    ageFile(brokerPaths(s.cfg).beat, RESTART_MS + 30_000);
    assert.equal(acquireLock(s.cfg).ok, true);
    assert.ok(Date.now() - statSync(brokerPaths(s.cfg).beat).mtimeMs < 5000);
  } finally { s.done(); }
});
