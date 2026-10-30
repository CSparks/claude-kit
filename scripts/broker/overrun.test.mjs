// overrun.test.mjs — a broker job over the 5-minute ceiling files a kit bug naming its dominant phase (KIT-D104).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CEILING_MS, overrun, reportOverrun, reportTrainOverrun } from './overrun.mjs';

const MIN = 60_000;
const SLOW = { status: 'landed', timings: [{ phase: 'apply', ms: 4000 }, { phase: 'pre-push gate', ms: 25 * MIN }, { phase: 'push', ms: 9000 }] };
const JOB = { id: 'j-1', repo: 'rapid-game', ticket: 'RG-T1' };
const collect = () => { const bugs = []; return { bugs, fileBug: (b) => { bugs.push(b); return true; } }; };

test('a job over the ceiling names its dominant phase, total and minutes', () => {
  const o = overrun(SLOW);
  assert.equal(o.phase, 'pre-push gate');
  assert.equal(o.phaseMs, 25 * MIN);
  const { bugs, fileBug } = collect();
  assert.equal(reportOverrun(JOB, SLOW, { fileBug }), true);
  assert.match(bugs[0].text, /rapid-game pre-push gate phase took 25\.0 min of 25\.2 min total; job j-1 \(RG-T1\)/);
});

test('minutes a job spent queued for the machine build slot are named in the report', () => {
  const queued = { ...SLOW, commands: [{ slotWaitMs: 4 * MIN }, { slotWaitMs: 0 }, {}] };
  const { bugs, fileBug } = collect();
  reportOverrun(JOB, queued, { fileBug });
  assert.match(bugs[0].text, /25\.2 min total, 4\.0 min of it queued for the machine build slot; job j-1/);
});

test('the report splits queue minutes from the minutes the commands ran', () => {
  const split = { status: 'passed', timings: [{ phase: 'run', ms: 12 * MIN }], commands: [{ slotWaitMs: 8 * MIN, durationMs: 3 * MIN }, { slotWaitMs: MIN, durationMs: MIN }] };
  const { bugs, fileBug } = collect();
  reportOverrun(JOB, split, { fileBug });
  assert.match(bugs[0].text, /run phase took 12\.0 min of 12\.0 min total, 9\.0 min of it queued for the machine build slot; commands ran 4\.0 min; job j-1/);
});

test('a phase that ran in several rounds is summed whole and the rounds are named', () => {
  const retried = { status: 'passed', timings: [{ phase: 'run', ms: 19 * MIN }, { phase: 'run', ms: 8 * MIN }, { phase: 'push', ms: 5000 }] };
  const o = overrun(retried);
  assert.deepEqual([o.phase, o.phaseMs, o.rounds], ['run', 27 * MIN, 2]);
  const { bugs, fileBug } = collect();
  reportOverrun(JOB, retried, { fileBug });
  assert.match(bugs[0].text, /run phase took 27\.0 min over 2 rounds of 27\.1 min total/);
});

test('the members of one train are one report naming every ticket; separate jobs stay separate', () => {
  const train = { id: 'train-a', members: ['a', 'b'] };
  const timings = [{ phase: 'run', ms: 9 * MIN }];
  const a = { id: 'a', repo: 'rapid-game', ticket: 'DE-T256', status: 'landed', train, timings, commands: [{ log: 'l1', slotWaitMs: 2 * MIN, durationMs: MIN }] };
  const b = { id: 'b', repo: 'rapid-game', ticket: 'MAR-T034', status: 'failed', train, timings, commands: [{ log: 'l2', slotWaitMs: MIN, durationMs: 2 * MIN }, { log: 'l1', slotWaitMs: 2 * MIN, durationMs: MIN }] };
  const solo = { id: 'c', repo: 'rapid-game', ticket: 'DE-T9', status: 'passed', timings };
  const { bugs, fileBug } = collect();
  assert.equal(reportTrainOverrun([a, b, solo], { fileBug }), 2);
  assert.match(bugs[0].text, /job train-a \(DE-T256 MAR-T034\), status landed\/failed/);
  assert.match(bugs[0].text, /3\.0 min of it queued for the machine build slot; commands ran 3\.0 min/, 'a command two members share counts once');
  assert.match(bugs[1].text, /job c \(DE-T9\)/);
});

test('control: a job at or under the ceiling, or one with no timings, files nothing', () => {
  const { bugs, fileBug } = collect();
  assert.equal(reportOverrun(JOB, { timings: [{ phase: 'run', ms: CEILING_MS }] }, { fileBug }), false);
  assert.equal(reportOverrun(JOB, { timings: [] }, { fileBug }), false);
  assert.equal(reportOverrun(JOB, {}, { fileBug }), false);
  assert.equal(reportTrainOverrun([{ id: 'x', repo: 'r', timings: [{ phase: 'run', ms: MIN }] }], { fileBug }), 0);
  assert.deepEqual(bugs, []);
});

test('a failing filer never throws into the queue', () => {
  const throwing = () => { throw new Error('cap missing'); };
  assert.equal(reportOverrun(JOB, SLOW, { fileBug: throwing }), false);
  assert.equal(reportTrainOverrun([{ id: 'x', repo: 'r', timings: SLOW.timings }], { fileBug: throwing }), 0);
});
