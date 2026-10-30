// measure.mjs build failures (KIT-T726): a measurement whose command does not compile ends `compile-error` with the compiler
// error in its message; `measured` stays for a command that ran. The submit precheck also covers a --measure job.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precheckJob } from './precheck.mjs';
import { runMeasurements } from './measure.mjs';
import { STATUS, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const DOES_NOT_COMPILE = String.raw`node -e "console.error('error[E0433]: cannot find module bevy_ecs'); console.error(' --> crates/x/tests/app.rs:27:10'); console.error(''); console.error('error: could not compile x (test app) due to 1 previous error'); process.exit(101)"`;
const RED_TEST_RUN = String.raw`node -e "console.log('test t ... FAILED'); console.log('frame_ms=16.4'); process.exit(101)"`;
const RUSTC_ERROR_CHECK = String.raw`node -e "console.error('error[E0308]: mismatched types'); console.error(' --> crates/x/src/lib.rs:3:5'); process.exit(101)"`;

function measureJob(s, test) {
  const job = buildPatchJob(s.cfg, { measure: true, ticket: 'KIT-T7', test }, envelope(['gamma', 'GAMMA'])).job;
  writeJob(s.cfg, job);
  return job;
}

test('a measurement command that fails to compile ends compile-error, naming the compiler error, and is not a red run', () => {
  const s = fixture();
  try {
    const job = measureJob(s, DOES_NOT_COMPILE);
    assert.deepEqual(runMeasurements(s.cfg, { busy: () => null }).ran, [job.id]);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, STATUS.BUILD_ERROR);
    assert.equal(r.phase, 'measure');
    assert.match(r.message, /did not build/);
    assert.match(r.message, /E0433.*bevy_ecs/);
    assert.equal(r.commands[0].exit, 101);
  } finally { s.done(); }
});

test('control: a measurement whose test ran and went red stays measured', () => {
  const s = fixture();
  try {
    const job = measureJob(s, RED_TEST_RUN);
    runMeasurements(s.cfg, { busy: () => null });
    assert.equal(readResult(s.cfg, job.id).status, STATUS.MEASURED);
  } finally { s.done(); }
});

test('the submit precheck rejects a --measure job whose patch has a rustc error; control: a clean check lets it queue', () => {
  const bad = fixture();
  const good = fixture();
  try {
    const run = (s, check) => {
      const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check } };
      const { job } = buildPatchJob(cfg, { measure: true, ticket: 'KIT-T7' }, envelope(['gamma', 'GAMMA']));
      return precheckJob(cfg, job, cfg.repos[0]);
    };
    const rejected = run(bad, RUSTC_ERROR_CHECK);
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.phase, 'precheck');
    assert.equal(run(good, String.raw`node -e "process.exit(0)"`), null);
  } finally { bad.done(); good.done(); }
});
