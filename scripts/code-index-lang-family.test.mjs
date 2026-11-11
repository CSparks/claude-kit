#!/usr/bin/env node
// `q code --lang cpp` covers a C++ project's headers (KIT-T964, KIT-T965): a `.h` is indexed as lang c, so the
// cpp token names the family cpp + c. A language outside the family stays out.
// Run: node scripts/code-index-lang-family.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { refreshIndex } from './code-index.mjs';
import { codeVerbRows, parseCodeArgs } from './code-index-query.mjs';
import { langsOfToken } from './code-index-extract.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const cache = mkdtempSync(join(tmpdir(), 'ci-lang-cache-'));
process.env.CLAUDE_KIT_CODE_INDEX_DIR = cache;
const root = mkdtempSync(join(tmpdir(), 'ci-lang-repo-'));
const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
put('package.json', '{}');
put('src/core/Constants.h', 'constexpr int kStepsPerBar = 16;\n');
put('src/core/Engine.cpp', 'int kStepsPerBarCopy = 16;\n');
put('src/core/lib.rs', 'pub const kStepsPerBarRs: u32 = 16;\n');

const refresh = (r, options) => refreshIndex(r, { ...options, dbPath: join(cache, 'i.db') });
const locs = async (args) => (await codeVerbRows('code', args, root, refresh)).map((r) => r.loc).filter(Boolean);

try {
  await test('the cpp token names cpp and c; other tokens stay single', () => {
    assert.deepEqual(langsOfToken('cpp').sort(), ['c', 'cpp']);
    assert.deepEqual(langsOfToken('h'), ['c']);
    assert.deepEqual(langsOfToken('rust'), ['rust']);
    assert.deepEqual(parseCodeArgs(['x', '--lang', 'cpp,rust']).flags.langs.sort(), ['c', 'cpp', 'rust']);
  });

  await test('q code --lang cpp finds a symbol defined only in a header', async () => {
    const found = await locs(['kStepsPerBar\\s*=', '--regex', '--lang', 'cpp', '--path', 'src']);
    assert.ok(found.includes('src/core/Constants.h:1'), `got ${found.join(', ')}`);
  });

  await test('--lang cpp returns the implementation file as well', async () => {
    const found = await locs(['kStepsPerBarCopy', '--lang', 'cpp']);
    assert.deepEqual(found, ['src/core/Engine.cpp:1']);
  });

  await test('control: --lang rust does not reach the header', async () => {
    assert.deepEqual(await locs(['kStepsPerBar\\s*=', '--regex', '--lang', 'rust']), []);
  });

  await test('control: --lang c still returns the header', async () => {
    assert.ok((await locs(['kStepsPerBar\\s*=', '--regex', '--lang', 'c'])).includes('src/core/Constants.h:1'));
  });
} finally {
  rmSync(root, { recursive: true, force: true });
  try { rmSync(cache, { recursive: true, force: true }); } catch { /* the index database stays open until exit */ }
}

console.log(`\ncode-index-lang-family: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
