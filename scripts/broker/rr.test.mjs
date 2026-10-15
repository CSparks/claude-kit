// rr.test.mjs — sessions are served in turn (KIT-T482 item 8): one session's burst no longer holds
// another session's patch behind it; a session's own jobs and jobs over the same path keep their
// submit order; the turn carries across drains.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { jobSession, roundRobin } from './rr.mjs';
import { fixture } from './patchkit.mjs';

const job = (id, session, ...paths) => ({ id, session, ops: paths.map((path) => ({ kind: 'write', path })) });
const ids = (list) => list.map((j) => j.id);

test('a burst from one session interleaves with another session, each keeping its own order', () => {
  const q = [job('a1', 'A', 'a1'), job('a2', 'A', 'a2'), job('a3', 'A', 'a3'), job('b1', 'B', 'b1'), job('b2', 'B', 'b2')];
  assert.deepEqual(ids(roundRobin(q)), ['a1', 'b1', 'a2', 'b2', 'a3']);
  assert.deepEqual(ids(roundRobin(q, 'A')), ['b1', 'a1', 'b2', 'a2', 'a3'], 'the turn after A is B');
});

test('a job never passes an older job of another session over the same path, through a chain', () => {
  const q = [job('a1', 'A', 'x'), job('a2', 'A', 'y'), job('a3', 'A', 'z'), job('b1', 'B', 'x', 'q'), job('c1', 'C', 'q')];
  assert.deepEqual(ids(roundRobin(q, 'A')), ['a1', 'b1', 'a2', 'c1', 'a3'], 'B waits for a1 (x), C for b1 (q)');
});

test('negative control: one session (or none) keeps plain submit order', () => {
  const q = [job('1', 'A', 'p'), job('2', 'A', 'q'), job('3', 'A', 'r')];
  assert.deepEqual(ids(roundRobin(q, 'A')), ['1', '2', '3']);
  assert.deepEqual(ids(roundRobin([job('1', null, 'p'), job('2', undefined, 'q')])), ['1', '2']);
});

test('the session comes from --session, then the harness env, else none', () => {
  assert.equal(jobSession({ session: 'mine' }, { CLAUDE_SESSION_ID: 'env' }), 'mine');
  assert.equal(jobSession({}, { CLAUDE_CODE_SESSION_ID: 'env2' }), 'env2');
  assert.equal(jobSession({}, {}), null);
});

test('the daemon serves the second session before the rest of the first one\'s burst', () => {
  const s = fixture();
  try {
    const cfg = { ...s.cfg, batch: 1 };
    const order = [];
    const put = (session, file) => {
      const { job: j } = buildPatchJob(cfg, { session, ticket: 'T-1' }, `*** write ${file}\nx\n`);
      return writeJob(cfg, { ...j, commands: ['node -e 0'] });
    };
    const a = [put('A', 'a1.txt'), put('A', 'a2.txt'), put('A', 'a3.txt')];
    const b = put('B', 'b1.txt');
    processOnce(cfg, { onResult: (r) => order.push(r.id) });
    assert.deepEqual(order, [a[0].id, b.id, a[1].id, a[2].id]);
    assert.equal(readResult(cfg, b.id).status, 'passed');
  } finally { s.done(); }
});
