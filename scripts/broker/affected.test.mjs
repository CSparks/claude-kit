// affected.test.mjs — changed paths map to the cargo test targets that exercise them (KIT-T472).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { selectAffected } from './affected.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const LAYOUT = {
  'Cargo.toml': '[workspace]\nmembers = ["crates/app"]\n',
  'crates/app/Cargo.toml': '[package]\nname = "app"\nversion = "0.1.0"\n\n[dependencies]\nname = "not-this"\n',
  'crates/app/src/lib.rs': 'pub mod camera;\npub mod track;\n',
  'crates/app/src/camera.rs': '',
  'crates/app/src/lonely.rs': '',
  'crates/app/src/track/mod.rs': '',
  'crates/app/src/bin/probe.rs': '',
  'crates/app/tests/alpha.rs': 'use app::camera::Rig;\n',
  'crates/app/tests/beta.rs': 'mod common;\nconst G: &str = "golden.json";\nuse app::track;\n',
  'crates/app/tests/common/mod.rs': '',
  'crates/app/tests/wall/main.rs': 'use app::camera_rig_extra;\n',
  'crates/app/tests/wall/sweep.rs': '',
  'crates/app/assets/golden.json': '{}',
  'tools/stray.rs': '',
};

const layout = () => {
  const dir = tempDir('affected-');
  for (const [p, text] of Object.entries(LAYOUT)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
};

const specs = (dir, paths) => {
  const sel = selectAffected(dir, paths);
  return { ...sel, app: [...(sel.crates.get('app') || [])].sort() };
};

test('test files, shared test modules, src modules, bins and assets map to their targets', () => {
  const dir = layout();
  try {
    assert.deepEqual(specs(dir, ['crates/app/tests/alpha.rs']).app, ['--test alpha']);
    assert.deepEqual(specs(dir, ['crates/app/tests/wall/sweep.rs']).app, ['--test wall'], 'a dir with main.rs is its own target');
    assert.deepEqual(specs(dir, ['crates/app/tests/common/mod.rs']).app, ['--test beta'], 'a shared module maps to the tests naming it');
    assert.deepEqual(specs(dir, ['crates/app/src/camera.rs']).app, ['--lib', '--test alpha'], 'word match: camera_rig_extra does not name camera');
    assert.deepEqual(specs(dir, ['crates/app/src/track/mod.rs']).app, ['--lib', '--test beta']);
    assert.deepEqual(specs(dir, ['crates/app/src/bin/probe.rs']).app, ['--bin probe']);
    assert.deepEqual(specs(dir, ['crates/app/assets/golden.json']).app, ['--test beta']);
    assert.deepEqual(specs(dir, ['crates/app/Cargo.toml']).app, ['--lib']);
    assert.deepEqual(specs(dir, ['crates\\app\\tests\\alpha.rs']).app, ['--test alpha'], 'Windows separators');
  } finally { cleanup(dir); }
});

test('negative: an unnamed module runs only the unit tests, docs pick nothing, a stray .rs is unmapped', () => {
  const dir = layout();
  try {
    assert.deepEqual(specs(dir, ['crates/app/src/lonely.rs']).app, ['--lib']);
    const docs = specs(dir, ['README.md', 'crates/app/NOTES.md']);
    assert.equal(docs.crates.size, 0);
    assert.deepEqual(docs.unmapped, []);
    assert.deepEqual(specs(dir, ['tools/stray.rs']).unmapped, ['tools/stray.rs']);
    assert.deepEqual(specs(dir, ['Cargo.toml']).unmapped, ['Cargo.toml'], 'the workspace manifest has no package');
    assert.deepEqual(specs(dir, ['crates/app/tests/gone.rs']).app, [], 'a deleted test file has no target left');
  } finally { cleanup(dir); }
});
