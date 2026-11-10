// daemon-state.test.mjs — `broker status` reports one truthful daemon line (KIT-T838): ALIVE with the heartbeat age, STALLED
// when the beat is old with jobs waiting, DEAD with no lock holder; the spawn reason is history, never the state. A deferred
// test whose HEAD has moved says it waits for an idle queue, not for a HEAD move.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';
import { daemonStateLine } from './daemon-state.mjs';
import { addDeferred, deferredLines } from './deferred.mjs';
import { revParse } from './git.mjs';
import { acquireLock, heartbeat } from './lock.mjs';
import { setup } from './subkit.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { STALL_MS } from './stall.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';

const SPAWNED = 'submit.mjs pid 5224: 1 job(s) queued with no daemon';
const holdLock = (s) => writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: '2026-11-02T17:55:15.922Z', runtime: 'beb8b5f', spawnedBy: SPAWNED }));
const ageBeat = (s, ms) => { const t = new Date(Date.now() - ms); utimesSync(brokerPaths(s.cfg).beat, t, t); };
const queueOne = (s) => writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });

test('a live holder with a fresh beat is ALIVE with its heartbeat age; the spawn reason is shown as history', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    holdLock(s);
    heartbeat(s.cfg);
    queueOne(s);
    const line = daemonStateLine(s.cfg);
    assert.match(line, /^broker: ALIVE, pid \d+ \(runtime beb8b5f\), heartbeat \d+ s ago, 1 queued; started 2026-11-02T17:55:15\.922Z by submit\.mjs pid 5224/);
    assert.doesNotMatch(line, /^broker: DEAD/);
  } finally { s.done(); }
});

test('an old beat with jobs waiting is STALLED; negative controls: an old beat with an empty queue is ALIVE, no holder is DEAD', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    holdLock(s);
    heartbeat(s.cfg);
    ageBeat(s, STALL_MS + 60_000);
    assert.match(daemonStateLine(s.cfg), /^broker: ALIVE, .*heartbeat 1\d\d s ago, 0 queued/);
    queueOne(s);
    assert.match(daemonStateLine(s.cfg), /^broker: STALLED, pid \d+ .*heartbeat 1\d\d s ago, 1 queued/);
    writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: 999999, host: hostname(), ts: '' }));
    assert.match(daemonStateLine(s.cfg), /^broker: DEAD, no daemon holds the lock, 1 queued/);
  } finally { s.done(); }
});

const HOUR_MS = 60 * 60 * 1000;
const queueAged = (s, ms) => writeJob(s.cfg, { id: `j-${(Date.now() - ms).toString(36)}-a`, repo: 'app', ops: [] });

test('a lane with queued jobs and no daemon is flagged with its lane and the oldest job\'s age; an empty lane is not', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    assert.doesNotMatch(daemonStateLine(s.cfg), /QUEUED WITHOUT A DAEMON/, 'control: an empty lane is quiet');
    queueAged(s, HOUR_MS);
    queueAged(s, 5 * 60 * 1000);
    assert.match(daemonStateLine(s.cfg), /^broker: DEAD, no daemon holds the lock, 2 queued, QUEUED WITHOUT A DAEMON in lane root: oldest waiting 60 min /);
    holdLock(s);
    heartbeat(s.cfg);
    assert.doesNotMatch(daemonStateLine(s.cfg), /QUEUED WITHOUT A DAEMON/, 'control: a live daemon holds the lane');
  } finally { s.done(); }
});

test('a live daemon with jobs queued reports how long the oldest waited and the tree another lane holds; control: its own lock is not listed', () => {
  const t = setup();
  try {
    const [, subLane] = laneConfigs(t.cfg);
    const lock = (lane, pid) => writeFileSync(join(t.root, 'target', 'broker', 'subtree', 'rapid-game.lock'), JSON.stringify({ lane, id: 'j-held', pid, host: hostname() }));
    mkdirSync(join(t.root, 'target', 'broker', 'subtree'), { recursive: true });
    writeJob(subLane, { id: `j-${(Date.now() - HOUR_MS).toString(36)}-a`, repo: 'rapid-game', ops: [] });
    acquireLock(subLane);
    lock('root', process.pid);
    const lines = daemonStateLine(subLane).split('\n');
    assert.match(lines[0], /^broker: ALIVE, /);
    assert.match(lines[1], /^ {2}oldest queued job has waited 60 min$/);
    assert.match(lines[2], /^ {2}rapid-game tree is held by lane root \(j-held, pid \d+\); a job that needs it waits$/);
    lock('rapid-game', process.pid);
    assert.equal(daemonStateLine(subLane).split('\n').length, 2, 'control: the lane\'s own hold is not a wait');
    lock('root', 999999);
    assert.equal(daemonStateLine(subLane).split('\n').length, 2, 'control: a dead holder is not a wait');
  } finally { t.done(); }
});

test('a deferred test whose repo HEAD moved says it waits for an idle queue; control: an unmoved HEAD still waits on a HEAD move', () => {
  const s = fixture();
  try {
    const base = { binary: null, reason: 'boom', cmd: 'cargo test', repo: 'app', job: 'j-1-a', dirty: [] };
    addDeferred(s.cfg, [{ ...base, test: 't_old', head: revParse(s.root, 'HEAD') }]);
    commitOnMain(s.root, 'moved.txt', 'x\n', 'move HEAD');
    addDeferred(s.cfg, [{ ...base, test: 't_new', head: revParse(s.root, 'HEAD') }]);
    const lines = deferredLines(s.cfg);
    assert.match(lines.find((l) => l.includes('t_old')), /waits on an idle queue \(HEAD has moved/);
    assert.match(lines.find((l) => l.includes('t_new')), /waits on a HEAD move\)$/);
  } finally { s.done(); }
});
