// overrun.test.mjs — a broker job over the 5-minute ceiling files a kit bug naming its dominant phase (KIT-D104).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CEILING_MS, overrun, reportOverrun } from './overrun.mjs';

const SLOW = { status: 'landed', timings: [{ phase: 'apply', ms: 4000 }, { phase: 'pre-push gate', ms: 25 * 60_000 }, { phase: 'push', ms: 9000 }] };
const JOB = { id: 'j-1', repo: 'rapid-game', ticket: 'RG-T1' };

test('a job over the ceiling names its dominant phase, total and minutes', () => {
  const o = overrun(SLOW);
  assert.equal(o.phase, 'pre-push gate');
  assert.equal(o.phaseMs, 25 * 60_000);
  const bugs = [];
  assert.equal(reportOverrun(JOB, SLOW, { fileBug: (b) => { bugs.push(b); return true; } }), true);
  assert.match(bugs[0].text, /rapid-game pre-push gate phase took 25\.0 min of 25\.2 min total; job j-1 \(RG-T1\)/);
});

test('control: a job at or under the ceiling, or one with no timings, files nothing', () => {
  const bugs = [];
  const fileBug = (b) => { bugs.push(b); return true; };
  assert.equal(reportOverrun(JOB, { timings: [{ phase: 'run', ms: CEILING_MS }] }, { fileBug }), false);
  assert.equal(reportOverrun(JOB, { timings: [] }, { fileBug }), false);
  assert.equal(reportOverrun(JOB, {}, { fileBug }), false);
  assert.deepEqual(bugs, []);
});

test('a failing filer never throws into the queue', () => {
  assert.equal(reportOverrun(JOB, SLOW, { fileBug: () => { throw new Error('cap missing'); } }), false);
});
