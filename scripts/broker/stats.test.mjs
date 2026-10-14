// stats.test.mjs — queue speed from result files (KIT-T482): waits split into behind-a-job and
// no-job-running, trains counted by their builds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './stats.mjs';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const S = 1000;
const id = (ms) => `j-${ms.toString(36)}-x`;
const iso = (ms) => new Date(ms).toISOString();
const result = (sub, start, end, extra = {}) => ({ id: id(sub), startedAt: iso(start), finishedAt: iso(end), status: 'landed', commands: [{ durationMs: (end - start) / 2 }], ...extra });

test('a job queued behind another waits behind it; a gap with no job running counts as idle', () => {
  const s = summarize([
    result(T0, T0, T0 + 60 * S),
    result(T0 + S, T0 + 60 * S, T0 + 120 * S),
    result(T0 + 130 * S, T0 + 190 * S, T0 + 200 * S),
  ]);
  assert.equal(s.jobs, 3);
  assert.equal(s.builds, 3);
  assert.equal(s.behindMin, 1);
  assert.equal(s.idleMin, 1);
  assert.equal(s.medianFirstCmdS, 30);
});

test('a train counts its builds once, not once per member', () => {
  const train = { id: 'train-x', builds: 2 };
  const s = summarize([result(T0, T0, T0 + 10 * S, { train }), result(T0, T0, T0 + 10 * S, { train }), result(T0, T0, T0 + 10 * S, { train })]);
  assert.deepEqual([s.jobs, s.trains, s.builds], [3, 1, 2]);
});

test('negative: a result reused from a green check is no build', () => {
  const s = summarize([result(T0, T0, T0 + S, { commands: [{ durationMs: 1, reusedFrom: 'j-a' }] })]);
  assert.equal(s.builds, 0);
});
