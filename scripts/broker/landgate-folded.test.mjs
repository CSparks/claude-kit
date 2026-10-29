// landgate-folded.test.mjs — a test binary folded from many files (tests/<area>/main.rs, one module per old file)
// is selected by the module that changed, as `--test <area> -- <module>::`, never as the whole area unless it must.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { selectAffected, splitSpecs } from './affected.mjs';
import { landGate } from './landgate.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const LAYOUT = {
  'Cargo.toml': '[workspace]\nmembers = ["crates/app"]\n',
  'crates/app/Cargo.toml': '[package]\nname = "app"\n',
  'crates/app/src/lib.rs': '',
  'crates/app/src/race/step.rs': '',
  'crates/app/src/ui/hud.rs': '',
  'crates/app/src/misc/orphan.rs': '',
  'crates/app/tests/flat.rs': 'use app::race::step;\n',
  'crates/app/tests/race/main.rs': '//! race tests, one binary\nmod step_flow;\nmod grid;\n',
  'crates/app/tests/race/step_flow.rs': 'use app::race::step;\n',
  'crates/app/tests/race/grid.rs': 'use super::step_flow;\n',
  'crates/app/tests/race/notes.json': '{}',
  'crates/app/tests/ui/main.rs': 'mod hud_layout;\n',
  'crates/app/tests/ui/hud_layout.rs': 'use app::ui::hud;\n',
  'crates/app/tests/common/mod.rs': '',
  'crates/app/tests/other/main.rs': '#[path = "../common/mod.rs"]\nmod common;\nmod checks;\n',
  'crates/app/tests/other/checks.rs': 'use super::common;\n',
};

function layout() {
  const dir = tempDir('landgate-fold-');
  for (const [p, text] of Object.entries(LAYOUT)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}

const cfg = () => ({ landGate: 'affected', suite: ['cargo test'], affected: { check: 'CHECK', test: 'cargo test', match: 'word', mandatory: false, dependents: false } });
const files = (...paths) => new Map(paths.map((p) => [`crates/app/${p}`, { text: 'x' }]));
const gate = (dir, ...paths) => landGate(cfg(), dir, { commands: [] }, files(...paths)).commands;

test('a changed module file runs its own module, and the modules that name it, in one filtered command', () => {
  const dir = layout();
  try {
    assert.deepEqual(gate(dir, 'tests/race/step_flow.rs'), ['CHECK', 'cargo test -p app --test race -- step_flow:: grid::']);
  } finally { cleanup(dir); }
});

test('a changed src module picks the flat target whole and only the folded modules that name it', () => {
  const dir = layout();
  try {
    assert.deepEqual(gate(dir, 'src/race/step.rs'), ['CHECK', 'cargo test -p app --lib --test flat', 'cargo test -p app --test race -- step_flow::']);
  } finally { cleanup(dir); }
});

test('the binary root, a non-module file of the area and a path-included shared dir run the whole binary', () => {
  const dir = layout();
  try {
    assert.deepEqual(gate(dir, 'tests/race/main.rs'), ['CHECK', 'cargo test -p app --test race']);
    assert.deepEqual(gate(dir, 'tests/race/notes.json'), ['CHECK', 'cargo test -p app --test race']);
    assert.deepEqual(gate(dir, 'tests/common/mod.rs'), ['CHECK', 'cargo test -p app --test other']);
  } finally { cleanup(dir); }
});

test('negative controls: the whole binary absorbs its own filters; a module no test names runs nothing extra', () => {
  const dir = layout();
  try {
    assert.deepEqual(gate(dir, 'tests/race/main.rs', 'tests/race/step_flow.rs'), ['CHECK', 'cargo test -p app --test race']);
    assert.deepEqual(gate(dir, 'src/ui/hud.rs'), ['CHECK', 'cargo test -p app --lib', 'cargo test -p app --test ui -- hud_layout::']);
    assert.deepEqual(gate(dir, 'src/misc/orphan.rs'), ['CHECK', 'cargo test -p app --lib'], 'no test names it: the lib alone');
    assert.deepEqual(splitSpecs(new Set(['--lib', '--test race', '--test race -- grid::', '--test ui -- hud_layout::'])), { plain: ['--lib', '--test race'], areas: new Map([['ui', ['hud_layout::']]]) });
  } finally { cleanup(dir); }
});

test('the picks record the module filters in the selection reasons', () => {
  const dir = layout();
  try {
    const sel = selectAffected(dir, ['crates/app/tests/ui/hud_layout.rs']);
    assert.deepEqual([...sel.crates.get('app')], ['--test ui -- hud_layout::']);
  } finally { cleanup(dir); }
});
