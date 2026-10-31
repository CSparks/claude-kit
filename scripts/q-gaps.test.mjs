#!/usr/bin/env node
// q-gaps.test.mjs — gaps agents went around q for: `q code --dir` (search outside the code index), --project name
// prefixes, grep-habit flags, `**/` globs in `q file`, --scope on scoped verbs, and a quiet exit when the reader closes the pipe.
// Run: node scripts/q-gaps.test.mjs

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { codeVerbRows } from './code-index-query.mjs';
import { scopeFlagToPositional } from './q-scope-flag.mjs';
import { matchProject } from './cap-routing.mjs';

let passed = 0;
const ok = async (name, fn) => { await fn(); passed++; console.log(`  ok    ${name}`); };
const dir = mkdtempSync(join(tmpdir(), 'kit-scan-'));
const norm = (p) => p.replace(/\\/g, '/');

try {
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'a.log'), 'alpha\nERROR beta\nERROR again\ngamma\n');
  writeFileSync(join(dir, 'sub', 'b.out'), 'ERROR deep\n');
  writeFileSync(join(dir, 'blob.bin'), Buffer.from([69, 82, 82, 79, 82, 0, 1, 2]));
  const rows = (args) => codeVerbRows('code', [...args, '--dir', dir], process.cwd());

  await ok('--dir finds hits in unindexed files with absolute paths, skipping binaries', async () => {
    const out = await rows(['ERROR']);
    assert.deepEqual(out.map((r) => r.loc).map(norm), [`${norm(dir)}/a.log:2`, `${norm(dir)}/a.log:3`, `${norm(dir)}/sub/b.out:1`]);
  });

  await ok('--dir -c gives per-file match counts', async () => {
    const out = await rows(['ERROR', '-c']);
    assert.deepEqual(out.map((r) => [norm(r.loc).split('/').pop(), r.text]), [['a.log', '2'], ['b.out', '1']]);
  });

  await ok('--dir takes one file and honours context lines and --regex', async () => {
    const out = await codeVerbRows('code', ['^ERR', '--regex', '-A', '1', '--dir', join(dir, 'a.log')], process.cwd());
    assert.deepEqual(out.map((r) => r.text), ['ERROR beta', 'ERROR again', 'gamma']);
  });

  await ok('negative: a missing --dir throws, a pattern in no file answers empty', async () => {
    await assert.rejects(codeVerbRows('code', ['x', '--dir', join(dir, 'nope')], process.cwd()), /does not exist/);
    assert.equal((await rows(['absent-token'])).filter((r) => r.loc).length, 0);
  });

  await ok('an empty --dir answer states the files read and the files skipped, so empty proves absence only for those (KIT-T745)', async () => {
    const empty = await rows(['absent-token']);
    const note = empty.find((r) => /^searched /.test(r.text));
    assert.ok(note, JSON.stringify(empty));
    assert.match(note.text, /searched 2 files under .*; NOT read: 1 \(blob\.bin \(binary\)\)/);
    assert.equal((await rows(['ERROR'])).some((r) => /^searched /.test(r.text)), false, 'hits carry no note');
  });

  await ok('--project accepts a name prefix that picks exactly one project', async () => {
    const mk = (name, key) => ({ name, key, aliases: new Set([name, key.toLowerCase()]) });
    const table = [mk('stiletto-2349', 'ST'), mk('stiletto-old', 'SO'), mk('dirt-empire', 'DE'), mk('dirt-bike', 'DB')];
    assert.equal(matchProject(table, 'dirt-e').name, 'dirt-empire');
    assert.equal(matchProject(table, 'stiletto'), null, 'two stilettos: ambiguous');
    assert.equal(matchProject(table, 'stiletto-2349').name, 'stiletto-2349');
    assert.equal(matchProject(table, 'de').name, 'dirt-empire', 'id key still matches exactly');
    assert.equal(matchProject(table, 'di'), null, 'under three characters is not a prefix match');
  });
  await ok('grep-habit flags -n -r -H are accepted and change nothing', async () => {
    const plain = await rows(['ERROR']);
    assert.deepEqual(await rows(['ERROR', '-n', '-r', '-H']), plain);
  });

  await ok('q file: **/ matches zero directories, a lone * still crosses /', async () => {
    const here = join(import.meta.dirname, '..');
    const found = await codeVerbRows('file', ['**/hooks/**/lib.mjs'], here);
    assert.ok(found.some((r) => r.loc === 'hooks/lib.mjs'), 'hooks/lib.mjs');
    const star = await codeVerbRows('file', ['hooks/*lib.mjs'], here);
    assert.ok(star.some((r) => r.loc === 'hooks/lib.mjs'));
  });

  await ok('scoped verbs read --scope and --scope= as the positional scope; other verbs are left alone', async () => {
    assert.deepEqual(scopeFlagToPositional('open', ['--status', 'todo', '--scope', 'DE']), ['--status', 'todo', 'DE']);
    assert.deepEqual(scopeFlagToPositional('rundown', ['--scope=ST']), ['ST']);
    assert.deepEqual(scopeFlagToPositional('fts', ['--scope', 'DE', 'x']), ['--scope', 'DE', 'x']);
    assert.throws(() => scopeFlagToPositional('open', ['--scope']), /takes a value/);
  });

  await ok('an empty answer names a framework submodule that is not checked out instead of proving absence', async () => {
    const game = mkdtempSync(join(tmpdir(), 'kit-fw-game-'));
    try {
      writeFileSync(join(game, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n\turl = x\n');
      writeFileSync(join(game, 'main.rs'), 'fn main() {}\n');
      const out = await codeVerbRows('code', ['no_such_symbol_zz', '--dir', game], game);
      assert.equal(out.some((r) => /NOT searched: framework submodule rapid-game/.test(r.text)), true, JSON.stringify(out));
      mkdirSync(join(game, 'rapid-game'));
      writeFileSync(join(game, 'rapid-game', 'lib.rs'), 'pub fn x() {}\n');
      const filled = await codeVerbRows('code', ['no_such_symbol_zz', '--dir', game], game);
      assert.equal(filled.some((r) => /NOT searched/.test(r.text)), false, 'a checked-out submodule is searched');
      const hit = await codeVerbRows('code', ['pub fn x', '--dir', game], game);
      assert.equal(hit.some((r) => r.loc), true);
      assert.equal(hit.some((r) => /NOT searched/.test(r.text)), false, 'hits carry no warning');
    } finally { rmSync(game, { recursive: true, force: true }); }
  });

  await ok('the CLI exits 0 and quietly when the reader closes the pipe', async () => {
    writeFileSync(join(dir, 'big.txt'), 'a line of output\n'.repeat(60000));
    const r = spawnSync(process.execPath, ['-e', `
      const { spawn } = require('node:child_process');
      const q = spawn(process.execPath, [process.argv[1], 'code', 'a', '--dir', process.argv[2], '--limit', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      q.stderr.on('data', (d) => { err += d; });
      q.stdout.once('data', () => q.stdout.destroy());
      q.on('close', (code) => { console.log(JSON.stringify({ code, err })); });
    `, join(import.meta.dirname, 'q.mjs'), dir], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_Q_SERVER: 'off' } });
    const out = JSON.parse(r.stdout.trim());
    assert.equal(out.err, '');
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
