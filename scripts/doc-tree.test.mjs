#!/usr/bin/env node
// Tests for scripts/doc-tree.mjs (KIT-T284): unit detection, generated index, lint rules.
// Pure fixtures in temp dirs. Run: node scripts/doc-tree.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';
import {
  findUnits, buildIndex, lintDocTree, purposeOf, trunkMap, INDEX_REL, TRUNK_MAX_LINES, HEADER_MAX_LINES,
} from './doc-tree.mjs';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const dirs = [];
function put(root, rel, text = '') {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'doc-tree-'));
  dirs.push(root);
  put(root, 'package.json', '{}');
  put(root, 'README.md', '# Trunk\n\nThe trunk map.\n');
  put(root, 'crates/alpha/Cargo.toml', '');
  put(root, 'crates/alpha/src/lib.rs', 'pub fn a() {}\n');
  put(root, 'crates/alpha/src/audio/mod.rs', 'pub fn b() {}\n');
  put(root, 'crates/alpha/tests/it.rs', 'fn t() {}\n');
  put(root, 'tools/gen.mjs', 'export const g = 1;\n');
  return root;
}
const rules = (root) => lintDocTree(root).map((f) => `${f.rule}:${f.path}`);

test('findUnits: root, crate, concern; src/ and tests/ are not concerns', () => {
  const root = fixture();
  assert.deepEqual(findUnits(root).map((u) => `${u.kind}:${u.dir}`),
    ['root:', 'crate:crates/alpha', 'concern:crates/alpha/src/audio', 'concern:tools']);
});

test('purposeOf: first prose line, skipping headings/badges/fences', () => {
  assert.equal(purposeOf('# T\n\n[![b](x)](y)\n\n```\ncode\n```\nThe [real](u) `purpose` line.\n'), 'The real purpose line.');
  assert.equal(purposeOf('# Only heading\n'), 'Only heading');
});

test('lint: missing headers are reported per unit; root with header is not', () => {
  const found = rules(fixture());
  assert.ok(found.includes('missing-header:crates/alpha'));
  assert.ok(found.includes('missing-header:crates/alpha/src/audio'));
  assert.ok(found.includes('missing-header:tools'));
  assert.ok(!found.includes('missing-header:.'));
});

test('lint: a fully documented tree with a fresh index is clean', () => {
  const root = fixture();
  put(root, 'crates/alpha/README.md', '# alpha\n\nAlpha crate.\n');
  put(root, 'crates/alpha/src/audio/README.md', '# audio\n\nAudio waves.\n');
  put(root, 'tools/README.md', '# tools\n\nGenerators.\n');
  put(root, INDEX_REL, buildIndex(root));
  assert.deepEqual(lintDocTree(root), []);
});

test('index: nests units under their parent and links header docs relative to docs/', () => {
  const root = fixture();
  put(root, 'crates/alpha/README.md', '# alpha\n\nAlpha crate.\n');
  const text = buildIndex(root);
  assert.match(text, /^- \[\.\]\(\.\.\/README\.md\) — The trunk map\.$/m);
  assert.match(text, /^ {2}- \[crates\/alpha\]\(\.\.\/crates\/alpha\/README\.md\) — Alpha crate\.$/m);
  assert.match(text, /^ {4}- `crates\/alpha\/src\/audio` — \(no header doc\)$/m);
});

test('lint: stale and missing index are flagged', () => {
  const root = fixture();
  assert.ok(rules(root).includes(`missing-index:${INDEX_REL}`));
  put(root, INDEX_REL, 'old\n');
  assert.ok(rules(root).includes(`stale-index:${INDEX_REL}`));
});

test('lint: header over the size cap is flagged (trunk and branch caps differ)', () => {
  const root = fixture();
  put(root, 'README.md', '# Trunk\n\nMap.\n' + 'line\n'.repeat(TRUNK_MAX_LINES));
  put(root, 'tools/README.md', '# tools\n\nGen.\n' + 'line\n'.repeat(HEADER_MAX_LINES));
  const found = rules(root);
  assert.ok(found.includes('header-too-long:README.md'));
  assert.ok(found.includes('header-too-long:tools/README.md'));
  put(root, 'tools/README.md', '# tools\n\nGen.\n' + 'line\n'.repeat(HEADER_MAX_LINES - 10));
  assert.ok(!rules(root).includes('header-too-long:tools/README.md'));
});

test('lint: orphan docs are flagged until linked from a header doc', () => {
  const root = fixture();
  put(root, 'docs/guide.md', '# Guide\n\nHow.\n');
  assert.ok(rules(root).includes('orphan-doc:docs/guide.md'));
  put(root, 'README.md', '# Trunk\n\nThe trunk map. See [guide](docs/guide.md).\n');
  assert.ok(!rules(root).includes('orphan-doc:docs/guide.md'));
});

test('lint: reachability follows doc-to-doc links', () => {
  const root = fixture();
  put(root, 'docs/a.md', '# A\n\nSee [b](b.md).\n');
  put(root, 'docs/b.md', '# B\n\nLeaf.\n');
  put(root, 'README.md', '# Trunk\n\nMap [a](docs/a.md).\n');
  const found = rules(root);
  assert.ok(!found.includes('orphan-doc:docs/b.md'));
});

test('lint: two header docs with one purpose, and two docs with one title, are duplicates', () => {
  const root = fixture();
  put(root, 'crates/alpha/README.md', '# alpha\n\nSame words.\n');
  put(root, 'tools/README.md', '# tools\n\nSame words.\n');
  put(root, 'docs/x.md', '# Same Title\n');
  put(root, 'docs/y.md', '# Same Title\n');
  const found = rules(root);
  assert.ok(found.includes('duplicate-doc:tools/README.md'));
  assert.ok(found.includes('duplicate-doc:docs/y.md'));
});

test('trunkMap: root plus units one level down only', () => {
  const root = fixture();
  put(root, 'crates/alpha/README.md', '# alpha\n\nAlpha crate.\n');
  const map = trunkMap(root);
  assert.equal(map[0], '. — The trunk map.');
  assert.ok(map.some((l) => l.startsWith('  crates/alpha — Alpha crate.')));
  assert.ok(!map.some((l) => l.includes('audio')));
});

for (const d of dirs) rmSync(d, { recursive: true, force: true });
console.log(`\ndoc-tree: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
