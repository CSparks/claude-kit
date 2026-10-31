// gate-check.test.mjs — the landing gate checks with the feature set its tests use (KIT-Q005 lever 1); a check
// feature the tests lack runs with the suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gateChecks } from './gate-check.mjs';
import { normalizeBroker } from './config.mjs';
import { runSuite } from './suite.mjs';
import { fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const CHECK = 'cargo check --offline --workspace --all-targets --features dirt-empire/tools';
const TEST = 'cargo test --offline';

test('a check feature the tests lack leaves the gate and runs scheduled', () => {
  const { gate, scheduled } = gateChecks(CHECK, TEST);
  assert.equal(gate, 'cargo check --offline --workspace --all-targets');
  assert.deepEqual(scheduled, [CHECK]);
});

test('the gate and the tests share one feature set, so each crate compiles once', () => {
  const { gate, scheduled } = gateChecks(CHECK, `${TEST} --features dirt-empire/tools`);
  assert.equal(gate, CHECK);
  assert.deepEqual(scheduled, [], 'nothing moved');
  const featuresOf = (cmd) => cmd.split(/\s+/).slice(cmd.split(/\s+/).indexOf('--features') + 1, cmd.split(/\s+/).indexOf('--features') + 2);
  assert.deepEqual(featuresOf(gate), featuresOf(`${TEST} --features dirt-empire/tools`));
});

test('the gate takes the tests features, wherever the check carried its own', () => {
  assert.equal(gateChecks('cargo check --features a/x -F b/y --workspace', 'cargo test --features=a/x').gate, 'cargo check --features a/x --workspace');
  assert.deepEqual(gateChecks('cargo check --features a/x -F b/y --workspace', 'cargo test --features=a/x').scheduled, ['cargo check --features a/x -F b/y --workspace']);
  assert.equal(gateChecks('cargo check --workspace', 'cargo test --features g/t').gate, 'cargo check --workspace --features g/t');
});

test('a cargo alias in the test prefix supplies the test features', () => {
  const expand = (prefix) => (prefix === 'cargo t' ? ['nextest', 'run', '--workspace', '--features', 'g/t'] : null);
  const { gate, scheduled } = gateChecks('cargo check --workspace --all-targets --features g/t', 'cargo t', expand);
  assert.equal(gate, 'cargo check --workspace --all-targets --features g/t');
  assert.deepEqual(scheduled, []);
});

test('negative control: no features anywhere leaves the check as configured', () => {
  assert.deepEqual(gateChecks('cargo check --workspace --all-targets', 'cargo test'), { gate: 'cargo check --workspace --all-targets', scheduled: [] });
});

test('normalizeBroker: affected.check is the gate check, fullCheck the configured one, scheduledChecks the moved check', () => {
  const root = tempDir('gate-check-');
  try {
    const cfg = normalizeBroker(root, { affected: { check: CHECK, test: TEST } });
    assert.equal(cfg.affected.check, 'cargo check --offline --workspace --all-targets');
    assert.equal(cfg.affected.fullCheck, CHECK);
    assert.deepEqual(cfg.scheduledChecks, [CHECK]);
  } finally { cleanup(root); }
});

test('the suite run carries the moved check after the suite commands, and a lane run does not', () => {
  const s = fixture();
  const dir = tempDir('gate-check-suite-');
  const log = join(dir, 'order').replace(/\\/g, '/');
  const rec = (tag) => `node -e "require('fs').appendFileSync('${log}','${tag}\\n')"`;
  try {
    s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], land_gate: 'affected', suite: [rec('SUITE')], suite_every: 1 });
    s.cfg.scheduledChecks = [rec('CHECK')];
    const ran = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);
    runSuite(s.cfg, { fileBug: () => assert.fail('green expected'), now: Date.now() });
    assert.deepEqual(ran(), ['SUITE', 'CHECK']);
    const lane = { ...s.cfg, lane: 'rapid-game' };
    assert.equal(runSuite(lane, { fileBug: () => assert.fail('green expected'), now: Date.now() }), null, 'a lane without its own suite runs nothing');
  } finally { cleanup(dir); s.done(); }
});
