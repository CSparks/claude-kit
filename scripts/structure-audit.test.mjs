#!/usr/bin/env node
// Tests for scripts/structure-audit.mjs (KIT-T282): one positive and one negative control per
// rule, on throwaway trees. Run: node scripts/structure-audit.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { auditStructure } from './structure-audit.mjs';
import { FILE_SOFT, FILE_HARD } from '../hooks/lib/limits.mjs';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const dirs = [];
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'struct-audit-'));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text ?? '');
  }
  return root;
}
const hits = (root, rule) => auditStructure(root).filter((f) => f.rule === rule).map((f) => f.path);
const crate = (name, extra = {}) => ({
  [`crates/${name}/Cargo.toml`]: '', [`crates/${name}/src/lib.rs`]: 'pub mod a;\n', [`crates/${name}/src/a.rs`]: 'pub fn a() {}\n', ...extra,
});

test('name-doubling: crate/src/<crate-name> is flagged; a distinct folder is not', () => {
  assert.deepEqual(hits(tree({ ...crate('audio', { 'crates/audio/src/audio/x.rs': 'fn x(){}' }) }), 'name-doubling'), ['crates/audio/src/audio']);
  assert.deepEqual(hits(tree({ ...crate('audio', { 'crates/audio/src/waves/x.rs': 'fn x(){}' }) }), 'name-doubling'), []);
});

test('name-doubling: a folder or module file named after the crate is flagged at any depth', () => {
  const root = tree({
    ...crate('materials', { 'crates/materials/src/render/materials/x.rs': 'fn x(){}', 'crates/materials/src/render/y.rs': 'fn y(){}' }),
    ...crate('terrain', { 'crates/terrain/src/scene/terrain/x.rs': 'fn x(){}', 'crates/terrain/src/scene/z.rs': 'fn z(){}' }),
    'sim/Cargo.toml': '', 'sim/src/lib.rs': 'pub mod sim;\n', 'sim/src/sim.rs': 'fn s(){}',
    'rg-engine/Cargo.toml': '', 'rg-engine/src/lib.rs': 'pub mod engine;\n', 'rg-engine/src/engine.rs': 'fn e(){}',
  });
  assert.deepEqual(hits(root, 'name-doubling').sort(), [
    'crates/materials/src/render/materials', 'crates/terrain/src/scene/terrain', 'rg-engine/src/engine.rs', 'sim/src/sim.rs',
  ]);
});

test('name-doubling: a sibling folder or file with a different name, and lib.rs, are not flagged', () => {
  const root = tree({
    ...crate('materials', { 'crates/materials/src/render/shading/x.rs': 'fn x(){}', 'crates/materials/src/render/surface.rs': 'fn y(){}' }),
    'rg-engine/Cargo.toml': '', 'rg-engine/src/lib.rs': 'pub mod core;\n', 'rg-engine/src/core.rs': 'fn c(){}',
  });
  assert.deepEqual(hits(root, 'name-doubling'), []);
});

test('name-doubling: <dir>/<dir> repetition is flagged', () => {
  assert.deepEqual(hits(tree({ 'screens/screens/a.rs': 'fn a(){}', 'screens/b.rs': 'fn b(){}' }), 'name-doubling'), ['screens/screens']);
});

test('single-file-folder: a lone source file is flagged; two files and src/ are not', () => {
  assert.deepEqual(hits(tree({ 'lone/only.rs': 'fn o(){}' }), 'single-file-folder'), ['lone']);
  assert.deepEqual(hits(tree({ 'pair/a.rs': 'fn a(){}', 'pair/b.rs': 'fn b(){}' }), 'single-file-folder'), []);
  assert.deepEqual(hits(tree({ 'src/lib.rs': 'fn a(){}' }), 'single-file-folder'), []);
});

test('ungrouped-folder: 21 source files in one folder are flagged; 20 are not', () => {
  const many = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`flat/f${i}.rs`, 'fn f(){}']));
  assert.deepEqual(hits(tree(many(21)), 'ungrouped-folder'), ['flat']);
  assert.deepEqual(hits(tree(many(20)), 'ungrouped-folder'), []);
});

test('two-homes: util vs helpers in one crate are flagged; the same name in two crates is not', () => {
  const one = tree({ ...crate('a', { 'crates/a/src/util/x.rs': 'fn x(){}', 'crates/a/src/helpers/y.rs': 'fn y(){}' }) });
  assert.deepEqual(hits(one, 'two-homes').sort(), ['crates/a/src/helpers', 'crates/a/src/util']);
  const two = tree({ ...crate('a', { 'crates/a/src/assets/x.rs': 'fn x(){}' }), ...crate('b', { 'crates/b/src/assets/y.rs': 'fn y(){}' }) });
  assert.deepEqual(hits(two, 'two-homes'), []);
});

test('orphan-module: an undeclared Rust file is flagged; a declared one and mod.rs hosts are not', () => {
  const root = tree({
    ...crate('a', { 'crates/a/src/stray.rs': 'fn s(){}', 'crates/a/src/net/mod.rs': 'pub mod wire;\n', 'crates/a/src/net/wire.rs': 'fn w(){}' }),
  });
  assert.deepEqual(hits(root, 'orphan-module').sort(), ['crates/a/src/net/mod.rs', 'crates/a/src/stray.rs']);
  const ok = tree({ ...crate('a', { 'crates/a/src/net/mod.rs': 'pub mod wire;\n', 'crates/a/src/net/wire.rs': 'fn w(){}' }), 'crates/a/src/lib.rs': 'pub mod a;\npub mod net;\n' });
  assert.deepEqual(hits(ok, 'orphan-module'), []);
});

test('orphan-module: name.rs + name/ style declares children', () => {
  const root = tree({
    'crates/a/Cargo.toml': '', 'crates/a/src/lib.rs': 'pub mod net;\n', 'crates/a/src/net.rs': 'pub mod wire;\n', 'crates/a/src/net/wire.rs': 'fn w(){}',
  });
  assert.deepEqual(hits(root, 'orphan-module'), []);
});

test('orphan-module: a #[path = "x.rs"] attribute declares the file', () => {
  const root = tree({ ...crate('a', { 'crates/a/src/a_tests.rs': 'fn t(){}' }), 'crates/a/src/a.rs': '#[path = "a_tests.rs"]\nmod tests;\n' });
  assert.deepEqual(hits(root, 'orphan-module'), []);
});

test('file size: over soft and over hard are distinguished; under is silent', () => {
  const body = (n) => 'x\n'.repeat(n);
  const root = tree({ 'a/soft.mjs': body(FILE_SOFT + 5), 'a/hard.mjs': body(FILE_HARD + 5), 'a/small.mjs': body(10), 'a/b.mjs': '' });
  assert.deepEqual(hits(root, 'file-over-soft'), ['a/soft.mjs']);
  assert.deepEqual(hits(root, 'file-over-hard'), ['a/hard.mjs']);
});

test('style-drift: a sibling without src/ is flagged when most siblings have one', () => {
  const files = { ...crate('a'), ...crate('b'), ...crate('c'), 'crates/d/Cargo.toml': '', 'crates/d/lib.rs': 'fn d(){}' };
  assert.deepEqual(hits(tree(files), 'style-drift'), ['crates/d']);
  assert.deepEqual(hits(tree({ ...crate('a'), ...crate('b'), ...crate('c') }), 'style-drift'), []);
});

test('style-drift: mod.rs vs name.rs module style among siblings, and mixed styles in one crate', () => {
  const modStyle = (n) => crate(n, { [`crates/${n}/src/x/mod.rs`]: 'fn m(){}' });
  const named = { ...crate('d', { 'crates/d/src/x.rs': 'fn m(){}', 'crates/d/src/x/y.rs': 'fn y(){}' }) };
  const root = tree({ ...modStyle('a'), ...modStyle('b'), ...modStyle('c'), ...named });
  const drift = auditStructure(root).filter((f) => f.rule === 'style-drift').map((f) => f.path);
  assert.deepEqual(drift, ['crates/d']);
  const mixed = tree({ ...crate('m', { 'crates/m/src/p/mod.rs': 'fn p(){}', 'crates/m/src/q.rs': 'fn q(){}', 'crates/m/src/q/r.rs': 'fn r(){}' }) });
  assert.deepEqual(hits(mixed, 'style-drift'), ['crates/m']);
});

test('a clean tree reports nothing', () => {
  assert.deepEqual(auditStructure(tree({ ...crate('alpha'), ...crate('beta') })), []);
});

for (const d of dirs) rmSync(d, { recursive: true, force: true });
console.log(`\nstructure-audit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
