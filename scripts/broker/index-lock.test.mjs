// index-lock.test.mjs — a landing rides out a briefly held .git/index.lock and, when the lock stays,
// names it with its age instead of failing silently (KIT-T544).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { retryOnIndexLock } from './index-lock.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const PASS = 'node -e "0"';

function land(s) {
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta', land: true }, envelope(['beta', 'BETA']));
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
}

const LOCKED_ERR = "fatal: Unable to create '/r/.git/index.lock': File exists.";

test('a failure on the index.lock is retried until the lock clears', () => {
  let calls = 0;
  const r = retryOnIndexLock(() => (++calls < 3 ? { code: 128, err: LOCKED_ERR } : { code: 0, err: '' }));
  assert.equal(r.code, 0);
  assert.equal(calls, 3);
});

test('control: any other git failure is returned at once, unretried', () => {
  let calls = 0;
  const r = retryOnIndexLock(() => { calls++; return { code: 1, err: 'fatal: pathspec did not match' }; });
  assert.equal(calls, 1);
  assert.equal(r.err, 'fatal: pathspec did not match');
});

test('an index.lock that stays fails the landing naming the lock file and its age', () => {
  const s = fixture();
  try {
    const lock = join(s.root, '.git', 'index.lock');
    writeFileSync(lock, '');
    const r = land(s);
    assert.equal(r.status, 'failed');
    assert.match(r.message, /index\.lock/);
    assert.match(r.message, /held \d+ s/);
    assert.ok(existsSync(lock), 'the foreign lock is never removed');
  } finally { s.done(); }
});

test('control: with no lock the landing needs no retry', () => {
  const s = fixture();
  try { assert.equal(land(s).status, 'landed'); } finally { s.done(); }
});
