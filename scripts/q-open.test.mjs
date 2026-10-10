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

await test('CLI accepts the flag and --help documents it', () => {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: join(tmp, 'plugin') };
  const q = (args) => spawnSync(process.execPath, [join(import.meta.dirname, 'q.mjs'), ...args], { encoding: 'utf8', env });
  assert.equal(q(['--root', root, '--no-db', 'open', '--status', 'todo']).status, 0);
  assert.match(q(['--help']).stdout, /open \[scope\] \[--status/);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\nq-open: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
