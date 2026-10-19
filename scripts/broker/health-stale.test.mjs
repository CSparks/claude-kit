// health-stale.test.mjs — a stale self-check entry clears itself (KIT-T514): stuck-inflight for a run that
// is already over (its jobs have final results, or it is idle work), and restore-mismatch once the
// paths it named match their pre-image again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { selfCheck } from './health.mjs';
import { capture, restore } from './preimage.mjs';
import { checkRestore } from './restore-check.mjs';
import { ensureDirs, writeResult } from './result.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';

const FLOOR_MS = 1000;
const LATE_MS = 60_000;
const liveLock = (s) => ensureDirs(s.cfg) && writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));
const kinds = (r) => r.entries.map((e) => e.kind);
const late = (journal) => Date.parse(journal.startedAt) + LATE_MS;

test('a job whose result is final is not stuck, and neither is idle work; a running job without one is', () => {
  const s = fixture();
  try {
    liveLock(s);
    const journal = capture(s.cfg, { id: 'j-done', cwd: s.root, paths: [] });
    const check = () => selfCheck(s.cfg, { now: late(journal), stuckFloorMs: FLOOR_MS });
    assert.deepEqual(kinds(check()), ['stuck-inflight'], 'control: no result, a long run');
    writeResult(s.cfg, { id: 'j-done', repo: 'app', status: 'cancelled', commands: [] });
    assert.deepEqual(kinds(check()), [], 'a final result means the journal is a leftover');
  } finally { s.done(); }
});

test('a suite run or a deferred re-check journal is never stuck-inflight', () => {
  const s = fixture();
  try {
    liveLock(s);
    for (const id of ['suite-abc1234', 'deferred']) {
      const journal = capture(s.cfg, { id, cwd: s.root, paths: [] });
      assert.deepEqual(kinds(selfCheck(s.cfg, { now: late(journal), stuckFloorMs: FLOOR_MS })), [], id);
    }
  } finally { s.done(); }
});

test('a train journal is over once every member has its result', () => {
  const s = fixture();
  try {
    liveLock(s);
    const journal = capture(s.cfg, { id: 'train-1', cwd: s.root, paths: [], members: ['j-a', 'j-b'] });
    const now = late(journal);
    writeResult(s.cfg, { id: 'j-a', repo: 'app', status: 'passed', commands: [] });
    assert.deepEqual(kinds(selfCheck(s.cfg, { now, stuckFloorMs: FLOOR_MS })), ['stuck-inflight'], 'one member still running');
    writeResult(s.cfg, { id: 'j-b', repo: 'app', status: 'cancelled', commands: [] });
    assert.deepEqual(kinds(selfCheck(s.cfg, { now, stuckFloorMs: FLOOR_MS })), []);
  } finally { s.done(); }
});

test('a restore-mismatch clears once the named paths match their pre-image again, with no later restore', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    commitOnMain(s.root, 'lib.rs', 'a\nb\n', 'add');
    const journal = capture(s.cfg, { id: 'j-m', cwd: s.root, paths: ['lib.rs'] });
    restore(s.cfg, journal);
    writeFileSync(join(s.root, 'lib.rs'), 'a\nsomething else\n');
    checkRestore(s.cfg, journal, 'j-m');
    assert.deepEqual(kinds(selfCheck(s.cfg, { skipNoDaemon: true })), ['own-fault:restore-mismatch']);
    writeFileSync(join(s.root, 'lib.rs'), 'a\nb\n');
    assert.deepEqual(kinds(selfCheck(s.cfg, { skipNoDaemon: true })), [], 'the tree is clean again');
  } finally { s.done(); }
});
