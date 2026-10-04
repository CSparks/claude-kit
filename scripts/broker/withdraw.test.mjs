// withdraw.test.mjs — `submit --revises <id>` withdraws a queued predecessor and `broker cancel <id>`
// cancels a queued job; a running job is never touched (KIT-T323).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { capture } from './preimage.mjs';
import { listQueue, readResult, writeJob, ensureDirs } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { processOnce } from './queue.mjs';
import { fixture } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const SUBMIT = join(import.meta.dirname, 'submit.mjs');
const WAIT = join(import.meta.dirname, 'wait.mjs');
const env = { ...process.env, BROKER_NO_AUTOSTART: '1' };
const run = (script, s, args, input = '') => spawnSync(process.execPath, [script, ...args, '--root', s.root], { input, encoding: 'utf8', env });
const queue = (s) => writeJob(s.cfg, { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: ['node -e "process.exit(0)"'] });

test('submit --revises withdraws the still-queued predecessor, whose result reads superseded by the new id', () => {
  const s = fixture();
  try {
    const old = queue(s);
    const sub = run(SUBMIT, s, ['--revises', old.id], '*** write q.txt\nq\n');
    assert.equal(sub.status, 0, sub.stderr);
    const next = sub.stdout.trim();
    const r = readResult(s.cfg, old.id);
    assert.equal(r.status, 'superseded');
    assert.equal(r.message, `superseded by ${next}`);
    assert.deepEqual(listQueue(s.cfg).map((j) => j.id), [next]);
    const w = run(WAIT, s, [old.id, '--timeout', '5']);
    assert.equal(w.status, 1);
    assert.match(w.stdout, /superseded/);
    assert.match(w.stdout, new RegExp(`superseded by ${next}`));
  } finally { s.done(); }
});

test('submit --revises leaves a RUNNING predecessor alone and says so', () => {
  const s = fixture();
  try {
    const old = queue(s);
    ensureDirs(s.cfg);
    capture(s.cfg, { id: old.id, cwd: s.root, paths: [] });
    const sub = run(SUBMIT, s, ['--revises', old.id], '*** write q.txt\nq\n');
    assert.equal(sub.status, 0);
    assert.match(sub.stderr, /not withdrawn: .*is running/);
    assert.equal(readResult(s.cfg, old.id), null);
    assert.equal(listQueue(s.cfg).length, 2, 'the running job stays queued; the revision joins it');
  } finally { s.done(); }
});

test('broker cancel withdraws a queued job; the daemon never runs it', () => {
  const s = fixture();
  try {
    const job = queue(s);
    const c = run(BROKER, s, ['cancel', job.id]);
    assert.equal(c.status, 0, c.stderr);
    assert.equal(readResult(s.cfg, job.id).status, 'cancelled');
    assert.equal(listQueue(s.cfg).length, 0);
    const sum = processOnce(s.cfg);
    assert.equal(sum.processed.length, 0);
    assert.equal(readResult(s.cfg, job.id).status, 'cancelled', 'not overwritten');
  } finally { s.done(); }
});

test('broker cancel on a running job is refused with a clear message and changes nothing', () => {
  const s = fixture();
  try {
    const job = queue(s);
    ensureDirs(s.cfg);
    capture(s.cfg, { id: job.id, cwd: s.root, paths: [] });
    const c = run(BROKER, s, ['cancel', job.id]);
    assert.equal(c.status, 1);
    assert.match(c.stderr, /is running; a running job is never cancelled/);
    assert.equal(listQueue(s.cfg).length, 1);
    assert.equal(readResult(s.cfg, job.id), null);
  } finally { s.done(); }
});

test('negative: cancel on an unknown or already finished id is refused, and a submit without --revises withdraws nothing', () => {
  const s = fixture();
  try {
    assert.match(run(BROKER, s, ['cancel', 'j-nope']).stderr, /is not queued/);
    const keep = queue(s);
    const sub = run(SUBMIT, s, [], '*** write q.txt\nq\n');
    assert.equal(sub.status, 0);
    assert.equal(listQueue(s.cfg).length, 2);
    assert.equal(readResult(s.cfg, keep.id), null);
    processOnce(s.cfg);
    assert.match(run(BROKER, s, ['cancel', keep.id]).stderr, /already finished \(passed\)/);
  } finally { s.done(); }
});
