// suite-refusal.test.mjs — under land_gate affected a worker job never runs the whole suite
// (KIT-T488): submit refuses a suite-shaped --test, and a test-only job with no --test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBroker } from './config.mjs';
import { SUITE_REFUSAL, buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const SUITE = 'cargo test --offline -p game';
const cfgFor = (s, gate) => normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: [SUITE], land_gate: gate });

test('affected: a suite-shaped --test, check-only or landing, and a bare --no-patch job are refused', () => {
  const s = fixture();
  try {
    const cfg = cfgFor(s, 'affected');
    assert.equal(buildPatchJob(cfg, { test: `${SUITE} -j 3` }, envelope(['beta', 'BETA'])).error, SUITE_REFUSAL);
    assert.equal(buildPatchJob(cfg, { test: 'cargo t -p other', land: true, ticket: 'T-1' }, envelope(['beta', 'BETA'])).error, SUITE_REFUSAL);
    assert.equal(buildPatchJob(cfg, { 'no-patch': true, test: SUITE }, '').error, SUITE_REFUSAL);
    assert.equal(buildPatchJob(cfg, { 'no-patch': true }, '').error, SUITE_REFUSAL, 'a test-only job with no --test would run verify_default');
  } finally { s.done(); }
});

test('negative: targeted tests are accepted, and land_gate full keeps the suite', () => {
  const s = fixture();
  try {
    const affected = cfgFor(s, 'affected');
    assert.ok(buildPatchJob(affected, { test: 'cargo t -p game --test a' }, envelope(['beta', 'BETA'])).job);
    assert.ok(buildPatchJob(affected, { 'no-patch': true, test: 'cargo t -p game -- held_steer' }, '').job);
    assert.ok(buildPatchJob(cfgFor(s, 'full'), { test: SUITE }, envelope(['beta', 'BETA'])).job);
  } finally { s.done(); }
});
