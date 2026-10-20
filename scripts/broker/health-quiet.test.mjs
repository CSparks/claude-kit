// health-quiet.test.mjs — stuck-inflight is about silence, not age: a long healthy train whose command
// logs keep growing is never flagged; the same run goes quiet and is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { selfCheck } from './health.mjs';
import { capture } from './preimage.mjs';
import { ensureDirs } from './result.mjs';
import { fixture } from './patchkit.mjs';

const FLOOR_MS = 1000;
const LONG_RUN_MS = 600_000;
const liveLock = (s) => ensureDirs(s.cfg) && writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));
const kinds = (r) => r.entries.map((e) => e.kind);

function logWrittenAt(s, name, atMs) {
  const file = join(brokerPaths(s.cfg).logs, name);
  writeFileSync(file, 'compiling\n');
  utimesSync(file, atMs / 1000, atMs / 1000);
}

test('a ten-minute train whose member log is still growing is not stuck', () => {
  const s = fixture();
  try {
    liveLock(s);
    const journal = capture(s.cfg, { id: 'train-1', cwd: s.root, paths: [], members: ['j-a', 'j-b'] });
    const now = Date.parse(journal.startedAt) + LONG_RUN_MS;
    logWrittenAt(s, 'j-a-0.log', now - FLOOR_MS / 2);
    assert.deepEqual(kinds(selfCheck(s.cfg, { now, stuckFloorMs: FLOOR_MS })), []);
  } finally { s.done(); }
});

test('negative control: the same train with a log quiet past the limit is stuck and says how long it was quiet', () => {
  const s = fixture();
  try {
    liveLock(s);
    const journal = capture(s.cfg, { id: 'train-1', cwd: s.root, paths: [], members: ['j-a', 'j-b'] });
    const now = Date.parse(journal.startedAt) + LONG_RUN_MS;
    logWrittenAt(s, 'j-a-0.log', now - 5 * FLOOR_MS);
    const r = selfCheck(s.cfg, { now, stuckFloorMs: FLOOR_MS });
    assert.deepEqual(kinds(r), ['stuck-inflight']);
    assert.match(r.entries[0].detail, /no output for 5s/);
  } finally { s.done(); }
});

test('a run that never wrote a log is judged from its start', () => {
  const s = fixture();
  try {
    liveLock(s);
    const journal = capture(s.cfg, { id: 'j-solo', cwd: s.root, paths: [] });
    const now = Date.parse(journal.startedAt) + 5 * FLOOR_MS;
    assert.deepEqual(kinds(selfCheck(s.cfg, { now, stuckFloorMs: FLOOR_MS })), ['stuck-inflight']);
  } finally { s.done(); }
});
