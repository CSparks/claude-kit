// q-code-paths.test.mjs — `q code|sym|file` with several --path values (KIT-T975): a repeated flag searches every
// named path, one flag still narrows to one, and a second path typed as a bare word is explained, not silently
// searched for as text. The repo is a real temp tree indexed for real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { codeVerbRows, parseCodeArgs } from './code-index-query.mjs';

process.env.CLAUDE_KIT_CODE_INDEX_DIR = mkdtempSync(join(tmpdir(), 'qp-cache-'));
const root = mkdtempSync(join(tmpdir(), 'qp-repo-'));
const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
put('package.json', '{}');
put('scripts/a.mjs', 'export const shared_marker = 1;\n');
put('hooks/b.mjs', 'export const shared_marker = 2;\n');
put('docs/c.md', 'shared_marker in the docs\n');

const files = async (args) => [...new Set((await codeVerbRows('code', ['shared_marker', ...args], root)).map((r) => r.loc.split(':')[0]).filter(Boolean))].sort();

test('a repeated --path searches every named path and nothing else', async () => {
  assert.deepEqual(await files(['--path', 'scripts', '--path', 'hooks']), ['hooks/b.mjs', 'scripts/a.mjs']);
});

test('control: one --path still narrows to that path, none searches everything', async () => {
  assert.deepEqual(await files(['--path', 'scripts']), ['scripts/a.mjs']);
  assert.deepEqual(await files([]), ['docs/c.md', 'hooks/b.mjs', 'scripts/a.mjs']);
});

test('q sym and q file take several --path values too', async () => {
  const sym = await codeVerbRows('sym', ['shared_marker', '--path', 'scripts', '--path', 'docs'], root);
  assert.deepEqual(sym.map((r) => r.loc).filter(Boolean).map((l) => l.split(':')[0]), ['scripts/a.mjs']);
  const file = await codeVerbRows('file', ['mjs', '--path', 'hooks', '--path', 'docs'], root);
  assert.deepEqual(file.map((r) => r.loc).filter(Boolean), ['hooks/b.mjs']);
});

test('a path typed as a bare word after --path is explained when nothing matches', async () => {
  const rows = await codeVerbRows('code', ['shared_marker', '--path', 'scripts', 'hooks'], root);
  assert.equal(rows.some((r) => r.loc), false);
  assert.match(rows.map((r) => r.text).join('\n'), /'hooks' follows --path scripts .*repeat the flag: --path scripts --path hooks/);
});

test('control: a bare word that is no path gets no explanation, and a search that matched needs none', async () => {
  const none = await codeVerbRows('code', ['shared_marker', '--path', 'scripts', 'nosuchword'], root);
  assert.doesNotMatch(none.map((r) => r.text).join('\n'), /repeat the flag/);
  const hit = await codeVerbRows('code', ['shared_marker', '--path', 'scripts'], root);
  assert.doesNotMatch(hit.map((r) => r.text).join('\n'), /repeat the flag/);
});

test('parseCodeArgs: one path is flags.path, several are flags.anyPaths', () => {
  assert.equal(parseCodeArgs(['x', '--path', 'a']).flags.path, 'a');
  const many = parseCodeArgs(['x', '--path', 'a', '--path', './b']).flags;
  assert.equal(many.path, undefined);
  assert.deepEqual(many.anyPaths, ['a', 'b']);
});
