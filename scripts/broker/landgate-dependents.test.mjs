// landgate-dependents.test.mjs — the affected land gate also tests the workspace crates that depend, through
// Cargo.lock, on a touched crate (KIT-D110); `affected.dependents: false` turns that off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { landGate } from './landgate.mjs';
import { pipelineConfig } from './pipeline-config.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const LOCK = [
  '[[package]]\nname = "base"\nversion = "0.1.0"\n',
  '[[package]]\nname = "mid"\nversion = "0.1.0"\ndependencies = [\n "base",\n]\n',
  '[[package]]\nname = "top"\nversion = "0.1.0"\ndependencies = [\n "mid",\n]\n',
  '[[package]]\nname = "lone"\nversion = "0.1.0"\n',
  '[[package]]\nname = "serde"\nversion = "1.0.0"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\ndependencies = [\n "base",\n]\n',
].join('\n');

const LAYOUT = {
  'Cargo.toml': '[workspace]\nmembers = ["crates/base", "crates/mid", "crates/top", "crates/lone"]\n',
  'Cargo.lock': LOCK,
  'crates/base/Cargo.toml': '[package]\nname = "base"\n',
  'crates/base/src/lib.rs': '',
  'crates/mid/Cargo.toml': '[package]\nname = "mid"\n',
  'crates/mid/src/lib.rs': '',
  'crates/top/Cargo.toml': '[package]\nname = "top"\n',
  'crates/top/src/lib.rs': '',
  'crates/lone/Cargo.toml': '[package]\nname = "lone"\n',
  'crates/lone/src/lib.rs': '',
};

function layout() {
  const dir = tempDir('landgate-deps-');
  for (const [p, text] of Object.entries(LAYOUT)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}

const cfg = (dependents) => ({ landGate: 'affected', suite: ['cargo test'], affected: { check: 'CHECK', test: 'cargo test', match: 'word', mandatory: false, dependents } });
const files = (...paths) => new Map(paths.map((p) => [p, { text: 'x' }]));

test('the gate adds the whole test run of every local crate that depends on a touched one', () => {
  const dir = layout();
  try {
    const gate = landGate(cfg(true), dir, { commands: [] }, files('crates/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', 'cargo test -p base --lib', 'cargo test -p mid', 'cargo test -p top']);
  } finally { cleanup(dir); }
});

test('a job that names its own --test commands still runs the dependents of the crate it touched (KIT-T719)', () => {
  const dir = layout();
  try {
    const own = ['cargo test -p base --test unit'];
    const gate = landGate(cfg(true), dir, { commands: own }, files('crates/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', ...own, 'cargo test -p mid', 'cargo test -p top']);
    assert.equal(gate.selection.explicit, true);
    assert.deepEqual(landGate(cfg(false), dir, { commands: own }, files('crates/base/src/lib.rs')).commands, ['CHECK', ...own], 'dependents off keeps the job list alone');
    assert.deepEqual(landGate(cfg(true), dir, { commands: own }, files('crates/top/src/lib.rs')).commands, ['CHECK', ...own], 'nothing depends on top');
  } finally { cleanup(dir); }
});

test('negative controls: dependents off, a leaf crate and a registry dependent add nothing', () => {
  const dir = layout();
  try {
    assert.deepEqual(landGate(cfg(false), dir, { commands: [] }, files('crates/base/src/lib.rs')).commands, ['CHECK', 'cargo test -p base --lib']);
    assert.deepEqual(landGate(cfg(true), dir, { commands: [] }, files('crates/top/src/lib.rs')).commands, ['CHECK', 'cargo test -p top --lib'], 'nothing depends on top');
    assert.ok(!landGate(cfg(true), dir, { commands: [] }, files('crates/base/src/lib.rs')).commands.some((c) => c.includes('serde')), 'serde is not a workspace crate');
  } finally { cleanup(dir); }
});

test('dependents are on by default and `dependents: false` in the config turns them off', () => {
  assert.equal(pipelineConfig({}, ['x'], {}).affected.dependents, true);
  assert.equal(pipelineConfig({ affected: { dependents: false } }, ['x'], {}).affected.dependents, false);
  assert.equal(pipelineConfig({}, ['x'], {}).landGate, 'affected', 'the new default');
  assert.equal(pipelineConfig({ land_gate: 'full' }, ['x'], {}).landGate, 'full', 'an explicit opt-out');
  assert.equal(pipelineConfig({}, ['x'], {}).suiteSchedule, 'nightly');
  assert.equal(pipelineConfig({ suite_every: 5 }, ['x'], {}).suiteSchedule, 'cadence', 'suite_every opts out of the nightly slot');
});
