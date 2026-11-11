#!/usr/bin/env node
// Frozen legacy code (KIT-T989): a repo's `legacy_dir` is left out of q code/sym/file, the fts side rows, code-graph
// and the doc tree by default; `--legacy` (or a --path inside it) brings it back.
// Run: node scripts/q-legacy.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { codeVerbRows, ftsCodeDefs, ftsDocLines, parseCodeArgs } from './code-index-query.mjs';
import { buildGraph, listSourceFiles } from './code-graph.mjs';
import { walkTree } from './tree-walk.mjs';
import { dropLegacy } from './q-legacy.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

process.env.CLAUDE_KIT_CODE_INDEX_DIR = mkdtempSync(join(tmpdir(), 'ql-cache-'));
const root = mkdtempSync(join(tmpdir(), 'ql-repo-'));
const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
put('.ai/config.yml', 'ids:\n  key: "GAM"\nlegacy_dir: legacy\n');
put('src/live.ts', 'export function frozenwidget() { return 1; }\n');
put('legacy/old/dead.ts', 'export function frozenwidget() { return 0; }\nexport function retiredgizmo() {}\n');
put('docs/note.md', 'frozenwidget notes\n');
put('legacy/README.md', 'frozenwidget history\n');

const locs = async (cmd, args) => (await codeVerbRows(cmd, args, root)).map((r) => r.loc).filter(Boolean);
const files = (all) => [...new Set(all.map((l) => l.split(':')[0]))];

await test('q code leaves legacy/ out by default', async () => {
  assert.deepEqual(files(await locs('code', ['frozenwidget'])).sort(), ['docs/note.md', 'src/live.ts']);
});
await test('q code --legacy brings it back', async () => {
  assert.ok(files(await locs('code', ['frozenwidget', '--legacy'])).includes('legacy/old/dead.ts'));
});
await test('q code --path legacy asks for it by name', async () => {
  assert.deepEqual(files(await locs('code', ['frozenwidget', '--path', 'legacy'])).sort(), ['legacy/README.md', 'legacy/old/dead.ts']);
});
await test('q sym and q file leave legacy/ out and take --legacy', async () => {
  assert.deepEqual(files(await locs('sym', ['retiredgizmo'])), []);
  assert.deepEqual(files(await locs('file', ['dead'])), []);
  assert.ok(files(await locs('sym', ['retiredgizmo', '--legacy'])).includes('legacy/old/dead.ts'));
  assert.ok(files(await locs('file', ['dead', '--legacy'])).includes('legacy/old/dead.ts'));
});
await test('--legacy is a known flag, not a gap', () => {
  assert.deepEqual(parseCodeArgs(['x', '--legacy']).flags.unknown, []);
});
await test('fts side rows (docs and code definitions) leave legacy/ out', async () => {
  assert.ok(!(await ftsDocLines('frozenwidget', root)).some((r) => r.loc.startsWith('legacy/')));
  assert.ok(!(await ftsCodeDefs('retiredgizmo', root)).some((r) => r.loc.startsWith('legacy/')));
});
await test('dropLegacy: no legacy_dir, no change', () => {
  const bare = mkdtempSync(join(tmpdir(), 'ql-bare-'));
  const flags = { notPaths: [] };
  dropLegacy(flags, bare);
  assert.deepEqual(flags.notPaths, []);
});
await test('code-graph leaves legacy/ out by default and keeps it with legacy: true', async () => {
  assert.ok(!listSourceFiles(root).some((f) => f.replace(/\\/g, '/').includes('/legacy/')));
  assert.ok(listSourceFiles(root, { legacy: true }).some((f) => f.replace(/\\/g, '/').includes('/legacy/')));
  assert.ok(!(await buildGraph(root)).files.some((f) => f.path.startsWith('legacy/')));
  assert.ok((await buildGraph(root, { legacy: true })).files.some((f) => f.path.startsWith('legacy/')));
});
await test('the doc tree walk skips legacy/', () => {
  const tree = walkTree(root);
  assert.ok(![...tree.keys()].some((rel) => rel === 'legacy' || rel.startsWith('legacy/')));
  assert.ok(tree.has('src'));
});

console.log(`\nq-legacy: ${pass} passed, ${fail} failed`);
// exitCode, not process.exit: exiting while the tree-sitter WASM runtime closes aborts the process on Windows.
process.exitCode = fail ? 1 : 0;
