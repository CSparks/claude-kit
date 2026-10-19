// landgate-explicit.test.mjs — the affected land gate tests a nested workspace's crates in that
// workspace, honours a job's own --test commands, and can match src modules by path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { selectAffected } from './affected.mjs';
import { landGate } from './landgate.mjs';
import { pipelineConfig } from './pipeline-config.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const LAYOUT = {
  'Cargo.toml': '[workspace]\nmembers = ["crates/app"]\n',
  'crates/app/Cargo.toml': '[package]\nname = "app"\n',
  'crates/app/src/lib.rs': '',
  'crates/app/src/ui/hud.rs': '',
  'crates/app/src/race/step.rs': '',
  'crates/app/tests/hud_layout.rs': 'use app::ui::hud;\n',
  'crates/app/tests/race_flow.rs': 'use app::race::{step, grid};\n',
  'crates/app/tests/loose.rs': '// the next step and the hud\nfn step() {}\n',
  'sub/rust/Cargo.toml': '[workspace]\nmembers = ["engine/phys"]\n',
  'sub/rust/engine/phys/Cargo.toml': '[package]\nname = "phys"\n',
  'sub/rust/engine/phys/src/lib.rs': '',
  'sub/rust/engine/phys/src/world.rs': '',
  'sub/rust/engine/phys/tests/wheels.rs': 'use phys::world;\n',
};

const layout = () => {
  const dir = tempDir('landgate-ws-');
  for (const [p, text] of Object.entries(LAYOUT)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
};

const cfg = (affected = {}) => ({ landGate: 'affected', suite: ['cargo test'], affected: { check: 'CHECK', test: 'cargo test', match: 'word', mandatory: false, ...affected } });
const files = (...paths) => new Map(paths.map((p) => [p, { text: 'x' }]));

test('a crate in a nested workspace is tested from that workspace; a root crate stays at the root', () => {
  const dir = layout();
  try {
    const sel = selectAffected(dir, ['sub/rust/engine/phys/src/world.rs', 'crates/app/src/ui/hud.rs']);
    assert.equal(sel.workspaces.get('phys'), 'sub/rust');
    assert.equal(sel.workspaces.get('app'), '');
    const gate = landGate(cfg(), dir, { commands: [] }, files('sub/rust/engine/phys/src/world.rs', 'crates/app/src/ui/hud.rs'));
    assert.deepEqual(gate.commands, ['CHECK', 'cd sub/rust && cargo test -p phys --lib --test wheels', 'cargo test -p app --lib --test hud_layout --test loose']);
  } finally { cleanup(dir); }
});

test('a lane whose checkout holds the workspace one level down enters it', () => {
  const dir = layout();
  const lane = join(dir, 'sub');
  try {
    const gate = landGate(cfg(), lane, { commands: [] }, files('rust/engine/phys/src/world.rs'));
    assert.deepEqual(gate.commands, ['CHECK', 'cd rust && cargo test -p phys --lib --test wheels']);
  } finally { cleanup(dir); }
});

test('a job that carries its own --test commands runs exactly those', () => {
  const dir = layout();
  try {
    const own = ['cd rust && cargo test -p phys --test wheels'];
    const gate = landGate(cfg(), join(dir, 'sub'), { commands: own }, files('rust/engine/phys/src/world.rs'));
    assert.deepEqual(gate.commands, own);
    assert.equal(gate.selection.explicit, true);
  } finally { cleanup(dir); }
});

test('mandatory affected still adds the mapped set; a suite-shaped command still leaves the gate', () => {
  const dir = layout();
  try {
    const own = ['cd rust && cargo test -p phys --test wheels'];
    const lane = join(dir, 'sub');
    const mandatory = landGate(cfg({ mandatory: true }), lane, { commands: own }, files('rust/engine/phys/src/world.rs'));
    assert.deepEqual(mandatory.commands, ['CHECK', 'cd rust && cargo test -p phys --lib --test wheels', ...own]);
    const suite = landGate(cfg(), lane, { commands: ['cargo test'] }, files('rust/engine/phys/src/world.rs'));
    assert.deepEqual(suite.commands, ['CHECK', 'cd rust && cargo test -p phys --lib --test wheels']);
    assert.deepEqual(suite.selection.dropped, ['cargo test']);
  } finally { cleanup(dir); }
});

test('module matching picks the tests that reach the module by path, not by a word', () => {
  const dir = layout();
  try {
    const picks = (match, path) => [...selectAffected(dir, [path], { match }).crates.get('app')].sort();
    assert.deepEqual(picks('word', 'crates/app/src/race/step.rs'), ['--lib', '--test loose', '--test race_flow']);
    assert.deepEqual(picks('module', 'crates/app/src/race/step.rs'), ['--lib', '--test race_flow']);
    assert.deepEqual(picks('word', 'crates/app/src/ui/hud.rs'), ['--lib', '--test hud_layout', '--test loose']);
    assert.deepEqual(picks('module', 'crates/app/src/ui/hud.rs'), ['--lib', '--test hud_layout']);
  } finally { cleanup(dir); }
});

test('the affected keys parse: match module and mandatory true, defaults word and false', () => {
  assert.deepEqual(pipelineConfig({ land_gate: 'affected', affected: { match: 'module', mandatory: true } }, []).affected, { check: 'cargo check --workspace --all-targets', test: 'cargo test', match: 'module', mandatory: true });
  const dflt = pipelineConfig({ land_gate: 'affected' }, []).affected;
  assert.equal(dflt.match, 'word');
  assert.equal(dflt.mandatory, false);
});
