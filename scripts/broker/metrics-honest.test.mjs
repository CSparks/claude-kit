// metrics-honest.test.mjs — broker stats count real work (KIT-T506): a train's shared commands and gate
// once, compile time from cargo's `Finished ... in Xs` lines, and an ST-T904 baseline taken from each
// job's own warm commands plus its land phases. A superseded write never replaces a run's result.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { metrics } from './metrics.mjs';
import { STATUS, ensureDirs, listQueue, readResult, writeJob, writeResult } from './result.mjs';
import { withdrawJob } from './withdraw.mjs';
import { fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const S = 1000;
const id = (ms, tag) => `j-${ms.toString(36)}-${tag}`;
const iso = (ms) => new Date(ms).toISOString();
const result = (sub, start, end, extra = {}) => ({ id: id(sub, extra.tag), startedAt: iso(start), finishedAt: iso(end), status: 'landed', commands: [], ...extra });

test('a 3-member train with one 100 s command and one 600 s gate reports testMin 1.7 and gateMin 10', () => {
  const shared = { commands: [{ cmd: 'cargo nextest run -p app', exit: 0, durationMs: 100 * S }], timings: [{ phase: 'pre-push gate', ms: 600 * S }] };
  const m = metrics(['a', 'b', 'c'].map((tag) => result(T0, T0, T0 + 700 * S, { tag, train: { id: 't1', size: 3 }, ...shared })));
  assert.equal(m.jobs, 3);
  assert.deepEqual([m.phases.testMin, m.phases.gateMin], [1.7, 10]);
});

test('control: three solo jobs count their own commands and gate each', () => {
  const own = { commands: [{ cmd: 'cargo nextest run -p app', exit: 0, durationMs: 100 * S }], timings: [{ phase: 'pre-push gate', ms: 600 * S }] };
  const m = metrics(['a', 'b', 'c'].map((tag) => result(T0, T0, T0 + 700 * S, { tag, ...own })));
  assert.deepEqual([m.phases.testMin, m.phases.gateMin], [5, 30]);
});

test('buildMin is the sum of the Finished lines in the command logs; testMin is the rest', () => {
  const dir = tempDir('metrics-log-');
  try {
    const log = join(dir, 'c.log');
    writeFileSync(log, '   Compiling x v0.1.0\n    Finished `test` profile [optimized + debuginfo] target(s) in 1m 30s\n     Running unittests\n');
    const m = metrics([result(T0, T0, T0 + 100 * S, { tag: 'a', commands: [{ cmd: 'cargo nextest run -p app', exit: 0, durationMs: 100 * S, log }] })]);
    assert.deepEqual([m.phases.buildMin, m.phases.testMin], [1.5, 0.2]);
  } finally { cleanup(dir); }
});

test('control: a missing log counts the whole command as test time', () => {
  const m = metrics([result(T0, T0, T0 + 120 * S, { tag: 'a', commands: [{ cmd: 'cargo test -p app', exit: 0, durationMs: 120 * S, log: join(tempDir('metrics-none-'), 'gone.log') }] })]);
  assert.deepEqual([m.phases.buildMin, m.phases.testMin], [0, 2]);
});

test('ST-T904 baseline is each job\'s own warm command time plus its land phases, so a fast red does not shrink it', () => {
  const warm = [{ cmd: 'cargo test -p app', exit: 0, durationMs: 300 * S }];
  const slow = result(T0, T0 + 200 * S, T0 + 900 * S, { tag: 'a', commands: warm, timings: [{ phase: 'pre-push gate', ms: 400 * S }] });
  const fastRed = result(T0, T0, T0 + 5 * S, { tag: 'b', status: 'failed', commands: [{ cmd: 'cargo test -p x', exit: 101, durationMs: 4 * S }] });
  const fastRed2 = { ...fastRed, id: id(T0, 'c') };
  const m = metrics([slow, fastRed, fastRed2]);
  assert.equal(m.target.singleS, 700, 'own = 300 s warm + 400 s gate; the failed job is excluded');
  assert.equal(m.target.meeting, 1, 'a 200 s wait is within 1.5x 700 s');
  assert.equal(m.target.share, 100);
});

test('a green job waiting longer than 1.5x its own time misses the target', () => {
  const warm = [{ cmd: 'cargo test -p app', exit: 0, durationMs: 100 * S }];
  const m = metrics([result(T0, T0 + 200 * S, T0 + 300 * S, { tag: 'a', commands: warm })]);
  assert.equal(m.target.meeting, 0);
});

test('withdrawing a queued job whose run already passed leaves the passed result', () => {
  const s = fixture();
  try {
    const job = writeJob(s.cfg, { repo: 'app', ops: [], commands: [] });
    writeResult(s.cfg, { id: job.id, repo: 'app', status: STATUS.PASSED, phase: 'run', startedAt: iso(T0), commands: [{ cmd: 'x', exit: 0, durationMs: 1 }] });
    const out = withdrawJob(s.cfg, job.id, { status: STATUS.SUPERSEDED, message: 'superseded by j-new' });
    assert.equal(out.ok, false);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
    assert.equal(readResult(s.cfg, job.id).startedAt, iso(T0));
  } finally { s.done(); }
});

test('control: withdrawing a queued job with no result still writes superseded', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const job = writeJob(s.cfg, { repo: 'app', ops: [], commands: [] });
    assert.equal(withdrawJob(s.cfg, job.id, { status: STATUS.SUPERSEDED, message: 'superseded by j-new' }).ok, true);
    assert.equal(readResult(s.cfg, job.id).status, 'superseded');
    assert.equal(listQueue(s.cfg).length, 0);
  } finally { s.done(); }
});
