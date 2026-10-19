// train-leftover.test.mjs — a queued job whose result is already final (a cancel or a finish whose queue
// file survived a stopped daemon) never runs again and never joins a train; the restarted daemon drops
// it, and the cancelled result stands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { formTrain } from './train-form.mjs';
import { runTrain } from './train.mjs';
import { STATUS, listQueue, queued, readResult, writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g } from './patchkit.mjs';

const FILES = ['a.txt', 'b.txt', 'c.txt'];
const PASS = 'node -e "0"';
const edit = (file) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${file} new\n>>>>>>> REPLACE\n`;

function setup() {
  const s = fixture();
  for (const f of FILES) writeFileSync(join(s.root, f), `${f} base\n`);
  g(['add', ...FILES], s.root);
  g(['commit', '-m', 'files'], s.root);
  g(['push', 'origin', 'main'], s.root);
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }] });
  const queue = (file) => {
    const { job } = buildPatchJob(s.cfg, { ticket: `T-${file[0]}`, title: `edit ${file}`, land: true }, edit(file));
    writeJob(s.cfg, { ...job, commands: [PASS] });
    return job;
  };
  return { s, queue };
}

const cancelled = (job) => ({ id: job.id, repo: 'app', status: STATUS.CANCELLED, phase: 'queue', commands: [], gate: [], stale: [], foreign: [], landed: null, message: 'cancelled by the operator' });

test('a cancelled job whose queue file survived does not join the train, and its result stays cancelled', () => {
  const { s, queue } = setup();
  try {
    const [a, b, c] = FILES.map(queue);
    writeResult(s.cfg, cancelled(b));
    assert.ok(queued(s.cfg, b.id), 'the leftover queue file is still there');
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, b.id).status, STATUS.CANCELLED);
    assert.deepEqual([a, c].map((j) => readResult(s.cfg, j.id).status), ['landed', 'landed']);
    assert.deepEqual([a, c].map((j) => readResult(s.cfg, j.id).train.members), [[a.id, c.id], [a.id, c.id]], 'the train carried the other two only');
    assert.deepEqual(listQueue(s.cfg), [], 'the leftover file is dropped');
    assert.equal(g(['log', '-3', '--pretty=%s'], s.root).includes('edit b.txt'), false, 'b was not landed');
  } finally { s.done(); }
});

test('a member cancelled after the train formed is dropped from its builds and landing', () => {
  const { s, queue } = setup();
  try {
    const [a, b, c] = FILES.map(queue);
    const pending = listQueue(s.cfg);
    const train = formTrain(s.cfg, pending[0], pending);
    assert.deepEqual(train.members.map((m) => m.job.id), [a.id, b.id, c.id]);
    writeResult(s.cfg, cancelled(b));
    runTrain(s.cfg, train.repo, train.members);
    assert.equal(readResult(s.cfg, b.id).status, STATUS.CANCELLED);
    assert.deepEqual([a, c].map((j) => readResult(s.cfg, j.id).status), ['landed', 'landed']);
    assert.equal(g(['log', '-3', '--pretty=%s'], s.root).includes('edit b.txt'), false, 'b was not landed');
  } finally { s.done(); }
});

test('control: a held job (dirty result) stays queued', () => {
  const { s, queue } = setup();
  try {
    const [a] = FILES.map(queue);
    writeResult(s.cfg, { ...cancelled(a), status: STATUS.DIRTY, message: 'held' });
    writeFileSync(join(s.root, 'a.txt'), 'hand edit\n');
    processOnce(s.cfg);
    assert.ok(queued(s.cfg, a.id), 'a dirty hold is not a final result');
  } finally { s.done(); }
});
