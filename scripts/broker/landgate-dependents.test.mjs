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
    assert.deepEqual(gate.commands, ['CHECK', 'cargo test -p base --lib', 'cargo test -p mid -p top'], 'one command names every dependent: cargo unifies features once (KIT-T801)');
  } finally { cleanup(dir); }
});

test('a job that names its own --test commands still runs the dependents of the crate it touched (KIT-T719)', () => {
  const dir = layout();
  try {
    const own = ['cargo test -p base --test unit'];
    const gate = landGate(cfg(true), dir, { commands: own }, files('crates/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', ...own, 'cargo test -p mid -p top']);
    assert.equal(gate.selection.explicit, true);
    assert.deepEqual(landGate(cfg(false), dir, { commands: own }, files('crates/base/src/lib.rs')).commands, ['CHECK', ...own], 'dependents off keeps the job list alone');
    assert.deepEqual(landGate(cfg(true), dir, { commands: own }, files('crates/top/src/lib.rs')).commands, ['CHECK', ...own], 'nothing depends on top');
  } finally { cleanup(dir); }
});

test('a dependent the project suite runs whole is left to the suite cadence, in a job with its own --test list and without (KIT-D104)', () => {
  const dir = layout();
  try {
    const suite = { ...cfg(true), suite: ['cargo test --offline -p top'] };
    const own = ['cargo test -p base --test unit'];
    const explicit = landGate(suite, dir, { commands: own }, files('crates/base/src/lib.rs'));
    assert.deepEqual(explicit.commands, ['CHECK', ...own, 'cargo test -p mid']);
    assert.deepEqual(explicit.selection.deferredDependents, ['top']);
    const mapped = landGate(suite, dir, { commands: [] }, files('crates/base/src/lib.rs'));
    assert.deepEqual(mapped.commands, ['CHECK', 'cargo test -p base --lib', 'cargo test -p mid']);
    assert.deepEqual(mapped.selection.deferredDependents, ['top']);
    const filtered = { ...cfg(true), suite: ['cargo test -p top --test slow'] };
    assert.deepEqual(landGate(filtered, dir, { commands: [] }, files('crates/base/src/lib.rs')).commands, ['CHECK', 'cargo test -p base --lib', 'cargo test -p mid -p top'], 'control: a filtered suite command is not a whole-crate run');
  } finally { cleanup(dir); }
});

test('a landing of the submodule\'s own repo runs its own --test list and leaves the dependents to the nightly suite (KIT-T1052)', () => {
  const dir = layout();
  try {
    const own = ['cd rust && cargo t --no-fail-fast -p base --lib scatter'];
    const lane = { ...cfg(true), repos: [{ name: 'game', path: '.' }, { name: 'fw', path: 'fw', submodule: true }] };
    const gate = landGate(lane, dir, { repo: 'fw', commands: own }, files('crates/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', ...own], 'check and the job\'s own test, no third step');
    assert.deepEqual(gate.selection.deferredDependents, ['mid', 'top']);
    const mapped = landGate(lane, dir, { repo: 'fw', commands: [] }, files('crates/base/src/lib.rs'));
    assert.deepEqual(mapped.commands, ['CHECK', 'cargo test -p base --lib'], 'a job with no commands runs its mapped tests only');
  } finally { cleanup(dir); }
});

test('control: a landing of a repo that is not a submodule still runs the dependents of the crate it touched', () => {
  const dir = layout();
  try {
    const own = ['cargo test -p base --test unit'];
    const lane = { ...cfg(true), repos: [{ name: 'game', path: '.' }, { name: 'fw', path: 'fw', submodule: true }] };
    assert.deepEqual(landGate(lane, dir, { repo: 'game', commands: own }, files('crates/base/src/lib.rs')).commands, ['CHECK', ...own, 'cargo test -p mid -p top']);
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
  assert.equal(pipelineConfig({}, ['x'], {}).landGate, 'check', 'the default compiles and runs only the named tests (KIT-T1115)');
  assert.equal(pipelineConfig({ land_gate: 'affected' }, ['x'], {}).landGate, 'affected', 'the mapped tests are an explicit opt-in');
  assert.equal(pipelineConfig({ land_gate: 'full' }, ['x'], {}).landGate, 'full', 'an explicit opt-out');
  assert.equal(pipelineConfig({}, ['x'], {}).suiteSchedule, 'nightly');
  assert.equal(pipelineConfig({ suite_every: 5 }, ['x'], {}).suiteSchedule, 'cadence', 'suite_every opts out of the nightly slot');
});
