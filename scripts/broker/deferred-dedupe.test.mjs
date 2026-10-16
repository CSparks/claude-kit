// deferred-dedupe.test.mjs — the deferred store holds one entry per test, drops a test once any run
// proves it green, and `broker status` prints a count plus one short line per test (KIT-T541).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDeferred, deferredLines, forgetPassed, listDeferred } from './deferred.mjs';
import { processOnce } from './queue.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { ensureDirs, readResult, writeJob } from './result.mjs';
import { fixture } from './patchkit.mjs';

const entry = (test, extra = {}) => ({ repo: 'app', test, binary: 'b', cmd: 'cargo t -p one', job: 'j-1', reason: 'boom', dirty: [], head: 'h', ...extra });

test('the same test under two commands is one entry; the newest command wins', () => {
  const s = fixture();
  try {
    addDeferred(s.cfg, [entry('t_a', { cmd: 'cargo t -p one' })]);
    addDeferred(s.cfg, [entry('t_a', { cmd: 'cargo t -p one --lib' }), entry('t_b')]);
    const list = listDeferred(s.cfg);
    assert.deepEqual(list.map((e) => e.test).sort(), ['t_a', 't_b']);
    assert.equal(list.find((e) => e.test === 't_a').cmd, 'cargo t -p one --lib');
  } finally { s.done(); }
});

test('control: the same test name under a different binary or repo stays separate', () => {
  const s = fixture();
  try {
    addDeferred(s.cfg, [entry('t_a'), entry('t_a', { binary: 'other' })]);
    assert.equal(listDeferred(s.cfg).length, 2);
  } finally { s.done(); }
});

test('entries stored twice by an older broker load as one', () => {
  const s = fixture();
  try {
    const dup = [entry('t_a', { cmd: 'one', deferredAt: '2026-10-01T00:00:00Z' }), entry('t_a', { cmd: 'two', deferredAt: '2026-10-02T00:00:00Z' })];
    writeFileSync(join(ensureDirs(s.cfg).home, 'deferred.json'), JSON.stringify(dup));
    const list = listDeferred(s.cfg);
    assert.equal(list.length, 1);
    assert.equal(list[0].cmd, 'two');
  } finally { s.done(); }
});

test('a test seen passing in a run is forgotten; others stay', () => {
  const s = fixture();
  try {
    addDeferred(s.cfg, [entry('t_a'), entry('t_b')]);
    forgetPassed(s.cfg, 'app', [{ binary: 'b', test: 't_a' }]);
    assert.deepEqual(listDeferred(s.cfg).map((e) => e.test), ['t_b']);
    forgetPassed(s.cfg, 'other-repo', [{ binary: 'b', test: 't_b' }]);
    assert.equal(listDeferred(s.cfg).length, 1, 'a pass in another repo proves nothing');
  } finally { s.done(); }
});

test('status prints a count and one line per test, never the dirty-path list', () => {
  const s = fixture();
  try {
    const dirty = Array.from({ length: 12 }, (_, i) => `assets/file-${i}.rhai`);
    addDeferred(s.cfg, [entry('t_a', { dirty }), entry('t_b', { dirty })]);
    const lines = deferredLines(s.cfg);
    assert.equal(lines.length, 3);
    assert.match(lines[0], /2 .*foreign test/);
    assert.match(lines[1], /t_a.*\[app\].*boom/);
    assert.ok(lines.every((l) => !l.includes('file-0.rhai')), 'no per-entry path list');
    assert.match(lines[1], /12 dirty path/);
  } finally { s.done(); }
});

test('no deferred entries print no status lines', () => {
  const s = fixture();
  try { assert.deepEqual(deferredLines(s.cfg), []); } finally { s.done(); }
});

test('a job run that sees a deferred test pass drops its entry without waiting for a re-check', () => {
  const s = fixture();
  try {
    addDeferred(s.cfg, [entry('t_a', { binary: null }), entry('t_b', { binary: null })]);
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1' }, '*** write marker.txt\nm\n');
    writeJob(s.cfg, { ...job, commands: [`node -e "console.log('test t_a ... ok')"`] });
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
    assert.deepEqual(listDeferred(s.cfg).map((e) => e.test), ['t_b']);
  } finally { s.done(); }
});
