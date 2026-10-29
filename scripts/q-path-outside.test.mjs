#!/usr/bin/env node
// KIT-T707: `q code --path <absolute dir outside the repo>` searches that directory on demand;
// a path that does not exist still errors, and an in-repo --path keeps using the index.
// Run: node scripts/q-path-outside.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { codeVerbRows } from './code-index-query.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const cache = mkdtempSync(join(tmpdir(), 'qpo-cache-'));
process.env.CLAUDE_KIT_CODE_INDEX_DIR = cache;
const repo = mkdtempSync(join(tmpdir(), 'qpo-repo-'));
const outside = mkdtempSync(join(tmpdir(), 'qpo-outside-'));
const put = (base, rel, text) => { mkdirSync(dirname(join(base, rel)), { recursive: true }); writeFileSync(join(base, rel), text); };
put(repo, '.ai/config.yml', 'ids:\n  key: "QPO"\n');
put(repo, 'src/inside.py', 'def inside_marker():\n    pass\n');
put(outside, 'comfy/nodes.py', 'class OutsideMarkerNode:\n    pass\n');
const posix = (p) => p.replace(/\\/g, '/');
const locs = (rows) => rows.map((r) => r.loc);

await test('an absolute --path outside the index is searched on demand', async () => {
  const rows = await codeVerbRows('code', ['OutsideMarkerNode', '--path', posix(join(outside, 'comfy'))], repo);
  assert.deepEqual(locs(rows), [`${posix(join(outside, 'comfy', 'nodes.py'))}:1`]);
});

await test('--lang and -l still filter an outside directory', async () => {
  const dir = posix(outside);
  assert.deepEqual(locs(await codeVerbRows('code', ['OutsideMarkerNode', '--path', dir, '--lang', 'py', '-l'], repo)), [`${dir}/comfy/nodes.py`]);
  assert.deepEqual(locs(await codeVerbRows('code', ['OutsideMarkerNode', '--path', dir, '--lang', 'rust'], repo)).filter(Boolean), []);
});

await test('an absolute --path that does not exist errors clearly', async () => {
  const missing = posix(join(outside, 'no-such-dir'));
  const rows = await codeVerbRows('code', ['OutsideMarkerNode', '--path', missing], repo);
  assert.equal(rows.length, 1);
  assert.match(rows[0].text, /outside the index and not found on disk/);
  assert.ok(rows[0].text.includes(missing));
});

await test('an in-repo --path still answers from the index and never sees the outside dir', async () => {
  assert.deepEqual(locs(await codeVerbRows('code', ['inside_marker', '--path', 'src'], repo)), ['src/inside.py:1']);
  assert.deepEqual(locs(await codeVerbRows('code', ['OutsideMarkerNode', '--path', 'src'], repo)).filter(Boolean), []);
});

rmSync(repo, { recursive: true, force: true });
rmSync(outside, { recursive: true, force: true });
rmSync(cache, { recursive: true, force: true });
console.log(`\nq-path-outside: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
