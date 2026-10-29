// batch-window.test.mjs — a lone trainable job waits for a train peer while two or more sessions are active,
// and runs at once otherwise (KIT-T683).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { ACTIVE_MS, activeSessions, batchHold } from './batch-window.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g } from './patchkit.mjs';

const WINDOW = 60_000;
const edit = (file, text) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${text}\n>>>>>>> REPLACE\n`;

function twoFileFixture() {
  const s = fixture();
  for (const f of ['a.txt', 'b.txt']) writeFileSync(join(s.root, f), `${f} base\n`);
  g(['add', 'a.txt', 'b.txt'], s.root);
  g(['commit', '-m', 'two files'], s.root);
  g(['push', 'origin', 'main'], s.root);
  const cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }] });
  const submit = (file, session, extra = {}) => {
    const { job } = buildPatchJob(cfg, { ticket: `T-${file[0]}`, land: false }, edit(file, `${file} new`));
    return writeJob(cfg, { ...job, commands: ['node -e "process.exit(0)"'], session, ...extra });
  };
  const finishedBy = (session, ageMs = 1000) => writeResult(cfg, { id: `j-${Date.now().toString(36)}-${session}`, repo: 'app', status: 'passed', session, commands: [], finishedAt: new Date(Date.now() - ageMs).toISOString() });
  return { ...s, cfg, submit, finishedBy };
}

test('a lone trainable job is held while two sessions are active', () => {
  const s = twoFileFixture();
  try {
    s.finishedBy('B');
    s.submit('a.txt', 'A');
    const hold = batchHold(s.cfg, listQueue(s.cfg), WINDOW);
    assert.ok(hold && hold.waitMs > 0 && hold.waitMs <= WINDOW);
    assert.equal(processOnce(s.cfg, { batchWindowMs: WINDOW }).processed.length, 0, 'processOnce holds the job');
    assert.equal(listQueue(s.cfg).length, 1);
  } finally { s.done(); }
});

test('negative controls: one session, an expired window, a second queued job, window 0 and a non-trainable job release it', () => {
  const s = twoFileFixture();
  try {
    const a = s.submit('a.txt', 'A');
    assert.equal(batchHold(s.cfg, listQueue(s.cfg), WINDOW), null, 'one active session: nothing to batch with');
    s.finishedBy('B');
    assert.ok(batchHold(s.cfg, listQueue(s.cfg), WINDOW));
    assert.equal(batchHold(s.cfg, listQueue(s.cfg), WINDOW, Date.parse(a.submittedAt) + WINDOW + 1), null, 'window over');
    assert.equal(batchHold(s.cfg, listQueue(s.cfg), 0), null, 'window 0 is off');
    s.submit('b.txt', 'B');
    assert.equal(batchHold(s.cfg, listQueue(s.cfg), WINDOW), null, 'a peer is queued: the train forms now');
  } finally { s.done(); }
});

test('a test-only job or a job with a pin is never held', () => {
  const s = twoFileFixture();
  try {
    s.finishedBy('B');
    const testOnly = buildPatchJob(s.cfg, { ticket: 'T-t', 'no-patch': true, test: 'node -e "0"' }, '').job;
    writeJob(s.cfg, { ...testOnly, session: 'A' });
    assert.equal(batchHold(s.cfg, listQueue(s.cfg), WINDOW), null, 'no operations: it measures the baseline, so it runs alone');
  } finally { s.done(); }
});

test('activity older than ACTIVE_MS does not count as a session', () => {
  const s = twoFileFixture();
  try {
    s.finishedBy('B', ACTIVE_MS + 60_000);
    s.submit('a.txt', 'A');
    assert.deepEqual([...activeSessions(s.cfg)], ['A']);
  } finally { s.done(); }
});

test('a peer that arrives during the hold joins the lone job in one train', () => {
  const s = twoFileFixture();
  try {
    s.finishedBy('B');
    const a = s.submit('a.txt', 'A');
    assert.equal(processOnce(s.cfg, { batchWindowMs: WINDOW }).processed.length, 0);
    const b = s.submit('b.txt', 'B');
    processOnce(s.cfg, { batchWindowMs: WINDOW });
    const [ra, rb] = [readResult(s.cfg, a.id), readResult(s.cfg, b.id)];
    assert.equal(ra.status, 'passed');
    assert.equal(rb.status, 'passed');
    assert.equal(ra.train.id, rb.train.id, 'one train carried both');
  } finally { s.done(); }
});
