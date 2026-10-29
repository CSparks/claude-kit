// measure.mjs — the measurement lane (KIT-D115): a `--measure` job is outside the landing queue, runs only as idle work in the
// check tree, yields to any landing job, ends `measured` (never a red run), and never delays a landing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runMeasurements } from './measure.mjs';
import { processOnce } from './queue.mjs';
import { STATUS, listMeasure, listQueue, queued, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, snapshot } from './patchkit.mjs';

const PRINTS_NUMBERS_AND_FAILS = String.raw`node -e "console.log('frame_ms=16.4 p99=22.1'); process.exit(1)"`;

function twoJobs(s) {
  const measure = buildPatchJob(s.cfg, { measure: true, ticket: 'KIT-T7', test: PRINTS_NUMBERS_AND_FAILS }, envelope(['gamma', 'GAMMA'])).job;
  const landing = buildPatchJob(s.cfg, { ticket: 'KIT-T8' }, envelope(['alpha', 'ALPHA'])).job;
  return { measure, landing };
}

test('a measurement job is in the measure list, not the landing queue; its file still counts as queued', () => {
  const s = fixture();
  try {
    const { measure, landing } = twoJobs(s);
    writeJob(s.cfg, measure);
    writeJob(s.cfg, landing);
    assert.deepEqual(listQueue(s.cfg).map((j) => j.id), [landing.id]);
    assert.deepEqual(listMeasure(s.cfg).map((j) => j.id), [measure.id]);
    assert.equal(queued(s.cfg, measure.id), true);
  } finally { s.done(); }
});

test('a landing is processed first and the measurement waits for idle: it runs after, ends measured with its numbers, and is not red', () => {
  const s = fixture();
  try {
    const { measure, landing } = twoJobs(s);
    writeJob(s.cfg, measure);
    writeJob(s.cfg, landing);
    const before = snapshot(s.root);
    const first = processOnce(s.cfg);
    assert.deepEqual(first.processed.map((r) => r.id), [landing.id], 'the landing job ran in the queue pass');
    const m = readResult(s.cfg, measure.id);
    assert.equal(m.status, STATUS.MEASURED);
    assert.equal(m.phase, 'measure');
    assert.equal(m.commands[0].exit, 1, 'red by design');
    assert.ok(m.commands[0].logTail.some((l) => l.includes('frame_ms=16.4')), 'the numbers are in the result');
    assert.equal(existsSync(join(s.cfg.targetDir, 'broker', 'queue', `${measure.id}.json`)), false, 'the job left the queue');
    assert.equal(readResult(s.cfg, landing.id).status, STATUS.PASSED);
    assert.deepEqual(snapshot(s.root), before, 'the live tree is untouched');
    const red = join(s.cfg.targetDir, 'broker', 'redruns.json');
    assert.equal(existsSync(red) ? Object.keys(JSON.parse(readFileSync(red, 'utf8'))).includes('KIT-T7') : false, false, 'a measurement is never a red run');
    const log = readFileSync(join(s.cfg.targetDir, 'broker', 'finished.log'), 'utf8');
    assert.ok(log.includes(`${measure.id} measured`));
  } finally { s.done(); }
});

test('control: a measurement job alone still runs when the lane is idle', () => {
  const s = fixture();
  try {
    const { measure } = twoJobs(s);
    writeJob(s.cfg, measure);
    const out = processOnce(s.cfg);
    assert.deepEqual(out.measured, [measure.id]);
    assert.equal(readResult(s.cfg, measure.id).status, STATUS.MEASURED);
  } finally { s.done(); }
});

test('a lane that is busy starts no measurement and leaves the job queued', () => {
  const s = fixture();
  try {
    const { measure } = twoJobs(s);
    writeJob(s.cfg, measure);
    const out = runMeasurements(s.cfg, { busy: () => 'lane root has a queued job' });
    assert.deepEqual(out, { ran: [], cancelled: false });
    assert.equal(queued(s.cfg, measure.id), true);
    assert.equal(readResult(s.cfg, measure.id), null);
  } finally { s.done(); }
});

test('a landing arriving mid-run abandons the measurement: the job stays queued with no result', () => {
  const s = fixture();
  try {
    const { measure } = twoJobs(s);
    writeJob(s.cfg, measure);
    const out = runMeasurements(s.cfg, { run: () => ({ cancelled: true, exit: 1, cmd: 'x', durationMs: 1 }) });
    assert.deepEqual(out, { ran: [], cancelled: true });
    assert.equal(queued(s.cfg, measure.id), true);
    assert.equal(readResult(s.cfg, measure.id), null);
  } finally { s.done(); }
});

test('submit refuses --measure with --land: a measurement never lands', () => {
  const s = fixture();
  try {
    assert.match(buildPatchJob(s.cfg, { measure: true, land: true, ticket: 'KIT-T9' }, envelope(['beta', 'BETA'])).error, /never lands/);
    assert.equal(buildPatchJob(s.cfg, { land: true, ticket: 'KIT-T9' }, envelope(['beta', 'BETA'])).error, undefined, 'control: a plain landing job');
  } finally { s.done(); }
});
