// stall.test.mjs — a daemon that holds the lock but stopped beating while jobs wait is reported
// STALLED and, past RESTART_MS, killed and replaced; a busy daemon keeps beating through a long
// command (KIT-T488).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { heartbeat } from './lock.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { runCommand } from './run.mjs';
import { RESTART_MS, STALL_MS, restartIfWedged, setPulse, stallLine, stallState } from './stall.mjs';
import { fixture } from './patchkit.mjs';

const holdLock = (s) => writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));
const ageBeat = (s, ms) => { const t = new Date(Date.now() - ms); utimesSync(brokerPaths(s.cfg).beat, t, t); };

test('a live holder whose beat is older than STALL_MS with jobs queued is STALLED; past RESTART_MS it is killed and replaced', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    holdLock(s);
    heartbeat(s.cfg);
    writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });
    ageBeat(s, STALL_MS + 30_000);
    const st = stallState(s.cfg);
    assert.ok(st);
    assert.match(stallLine(st), /^STALLED: no beat for 1\d\d s, 1 queued \(pid \d+\)$/);
    const killed = [];
    const started = [];
    assert.equal(restartIfWedged(s.cfg, s.root, { kill: (pid) => killed.push(pid), spawner: (r) => started.push(r) }), false, 'stalled but not yet past RESTART_MS');
    ageBeat(s, RESTART_MS + 30_000);
    assert.equal(restartIfWedged(s.cfg, s.root, { kill: (pid) => killed.push(pid), spawner: (r) => started.push(r) }), true);
    assert.deepEqual([killed, started], [[process.pid], [s.root]]);
  } finally { s.done(); }
});

test('negative: a fresh beat, an empty queue, or no lock holder is not a stall', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    holdLock(s);
    heartbeat(s.cfg);
    writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });
    assert.equal(stallState(s.cfg), null, 'fresh beat');
    ageBeat(s, RESTART_MS + 30_000);
    assert.equal(stallState(s.cfg, Date.now()) !== null, true);
    writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: 999999, host: hostname(), ts: '' }));
    assert.equal(stallState(s.cfg), null, 'a dead holder is the no-daemon case, not a stall');
  } finally { s.done(); }
});

test('with a pulse registered, a long command keeps the beat fresh; negative: without one the beat is untouched', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    heartbeat(s.cfg);
    ageBeat(s, STALL_MS);
    const before = statSync(brokerPaths(s.cfg).beat).mtimeMs;
    const run = () => runCommand('node -e "setTimeout(()=>{},2500)"', { cwd: s.root, targetDir: s.cfg.targetDir, logPath: join(s.cfg.targetDir, 'broker', 'logs', 'long.log'), jobs: 2 });
    assert.equal(run().exit, 0);
    assert.equal(statSync(brokerPaths(s.cfg).beat).mtimeMs, before, 'no pulse: nothing beats');
    setPulse(() => heartbeat(s.cfg));
    try {
      const r = run();
      assert.equal(r.exit, 0);
      assert.ok(Date.now() - statSync(brokerPaths(s.cfg).beat).mtimeMs < 5000, 'the beat moved during the command');
    } finally { setPulse(null); }
  } finally { s.done(); }
});
