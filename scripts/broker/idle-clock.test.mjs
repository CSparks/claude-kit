// idle-clock.test.mjs — a daemon never exits behind a queued job, and one started with jobs already in queue/
// runs them before it idles out (KIT-T916).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pause } from './control.mjs';
import { idleExpired, workPending } from './idle-clock.mjs';
import { brokerPaths } from './config.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, trackCargo } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const IDLE_MS = 1000;
const LONG_AGO = 10;

test('workPending: an empty broker has none; a queued job is pending until it leaves queue/', () => {
  const s = fixture();
  try {
    assert.equal(workPending(s.cfg), false);
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    assert.equal(listQueue(s.cfg).length, 1);
    assert.equal(workPending(s.cfg), true, 'the queued job keeps the idle clock from running');
    rmSync(join(brokerPaths(s.cfg).queue, `${job.id}.json`));
    assert.equal(workPending(s.cfg), false, 'control: an emptied queue is not work');
    assert.equal(workPending(s.cfg, [{ id: 'j-1' }]), true, 'a drain that processed a job is work');
    pause(s.cfg);
    assert.equal(workPending(s.cfg), true, 'a paused broker is work');
  } finally { s.done(); }
});

test('idleExpired: only past the limit, never when the limit is unset', () => {
  const now = Date.now();
  assert.equal(idleExpired({ idleMs: IDLE_MS, lastWork: now - IDLE_MS - LONG_AGO, now }), true);
  assert.equal(idleExpired({ idleMs: IDLE_MS, lastWork: now - LONG_AGO, now }), false);
  assert.equal(idleExpired({ idleMs: 0, lastWork: now - IDLE_MS * LONG_AGO, now }), false);
});

test('a daemon started on a populated queue runs the job before it idles out', () => {
  const s = trackCargo(fixture());
  try {
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    const r = spawnSync(process.execPath, [BROKER, '--idle-exit', '0.02', '--poll', '100', '--root', s.root], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, r.stderr);
    assert.notEqual(readResult(s.cfg, job.id), null, r.stderr);
    assert.ok(r.stderr.indexOf(`${job.id} →`) !== -1 && r.stderr.indexOf(`${job.id} →`) < r.stderr.indexOf('idle for'), 'the job ran before the idle exit');
    assert.equal(listQueue(s.cfg).length, 0);
  } finally { s.done(); }
});
