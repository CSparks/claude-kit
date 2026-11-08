#!/usr/bin/env node
// Tests for `q open --status` (KIT-T398): narrows the open set to the named statuses (comma
// list), identically on the cache path and the markdown-scan path; bad values are rejected.
// Run: node scripts/q-open.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { hydrate } from './hydrate-db.mjs';
import { query } from './q-lib.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'kit-q-open-'));
const root = join(tmp, 'proj');
const dbPath = join(tmp, 'workflow.db');
mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: "FQO"\n  pad: 3\n');
for (const [n, status] of [[1, 'todo'], [2, 'doing'], [3, 'review'], [4, 'done']]) {
  writeFileSync(join(root, '.ai', 'tickets', `FQO-T00${n}-x.md`), `---\nid: FQO-T00${n}\ntitle: t${n}\ntype: bug\nstatus: ${status}\npriority: high\n---\n`);
}

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

await hydrate({ root, dbPath });
const open = async (args, noDb) => (await query('open', args, { root, dbPath, noDb })).rows.map((r) => r.status).sort();

for (const noDb of [false, true]) {
  const path = noDb ? 'scan' : 'cache';
  await test(`open --status filters (${path})`, async () => {
    assert.deepEqual(await open([], noDb), ['doing', 'review', 'todo']);
    assert.deepEqual(await open(['--status', 'todo'], noDb), ['todo']);
    assert.deepEqual(await open(['--status=doing'], noDb), ['doing']);
    assert.deepEqual(await open(['--status', 'todo,review'], noDb), ['review', 'todo']);
    assert.deepEqual(await open(['FQO', '--status', 'review'], noDb), ['review'], 'scope token and flag combine');
  });
}

await test('open --status rejects values outside todo|doing|review', async () => {
  await assert.rejects(open(['--status', 'done']), /--status takes todo\|doing\|review/);
});

for (const noDb of [false, true]) {
  await test(`open --limit keeps the first N rows, 0 keeps all (${noDb ? 'scan' : 'cache'}) (KIT-T904)`, async () => {
    assert.equal((await open(['--limit', '2'], noDb)).length, 2);
    assert.equal((await open(['--limit=1'], noDb)).length, 1);
    assert.equal((await open(['--limit', '0'], noDb)).length, 3);
    assert.equal((await open(['--limit', '9'], noDb)).length, 3);
    assert.deepEqual(await open(['FQO', '--limit', '2', '--status', 'todo,doing'], noDb).then((r) => r.length), 2, 'the count is never taken for the scope token');
  });
}

await test('open --limit rejects a value that is no count (KIT-T904)', async () => {
  await assert.rejects(open(['--limit', 'many']), /--limit takes a count/);
  await assert.rejects(open(['--limit', '-1']), /--limit takes a count/);
});

await test('CLI accepts the flags, an unknown flag still errors, --help documents them', () => {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: join(tmp, 'plugin') };
  const q = (args) => spawnSync(process.execPath, [join(import.meta.dirname, 'q.mjs'), ...args], { encoding: 'utf8', env });
  assert.equal(q(['--root', root, '--no-db', 'open', '--status', 'todo']).status, 0);
  const limited = q(['--root', root, '--no-db', 'open', '--limit', '0']);
  assert.equal(limited.status, 0);
  assert.doesNotMatch(limited.stderr, /does not take/);
  assert.equal(q(['--root', root, '--no-db', 'open', '--limit', '2', '--json']).stdout.match(/FQO-T00\d/g).length, 2);
  assert.match(q(['--root', root, '--no-db', 'open', '--bogus']).stderr, /'open' does not take --bogus/);
  assert.match(q(['--help']).stdout, /open \[scope\] \[--status[^\n]*\[--limit N\]/);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\nq-open: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
