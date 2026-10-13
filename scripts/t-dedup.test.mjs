#!/usr/bin/env node
// Tests for the `t new` dedup gate (KIT-T353): open items scoring >= DEDUP_SCORE that share
// title terms refuse the new ticket; --not-dup overrides and is recorded in Notes.
// Scores in the fixtures are the real bm25 values measured on the stiletto-2349 store
// (2026-10-13): the ST-T892 title against ST-T839 = 25.2, a new unrelated title = 9.5.
// Run: node scripts/t-dedup.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findDuplicates, refusal, DEDUP_SCORE } from './t-dedup.mjs';
import { scaffoldNew } from './t.mjs';
import { resolveEngine } from './db-engine.mjs';
import { hydrate } from './hydrate-db.mjs';
import { query } from './q-lib.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const tmp = mkdtempSync(join(tmpdir(), 'kit-tdedup-'));
const project = (name, key) => {
  const root = join(tmp, name);
  mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
  return root;
};
const root = project('p', 'TDD');
const fake = (rows) => async () => ({ rows, cached: true });

const NEW_TITLE = 'First sim tick after driving into an area takes 264-438 ms: deposit outlines are built lazily on the sim thread';
const T839 = { id: 'ST-T839', status: 'todo', score: 25.2, title: 'mine_drive sim_tick_cost_along_the_round_trip_is_reported: one surface sim tick 222-589 ms against a 250 ms ceiling' };

try {
  await test('the real ST-T892 / ST-T839 pair is refused, naming the open item', async () => {
    const hits = await findDuplicates(root, NEW_TITLE, fake([T839]));
    assert.deepEqual(hits.map((h) => h.id), ['ST-T839']);
    assert.match(refusal(NEW_TITLE, hits), /ST-T839 \[todo\] mine_drive[\s\S]*--not-dup/);
  });
  await test('NEGATIVE CONTROL: a genuinely new title passes (real score 9.5)', async () => {
    const hits = await findDuplicates(root, 'Add a dance emote animation to the engineer character',
      fake([{ id: 'ST-T710', status: 'review', score: 9.5, title: 'Research low-poly character modeling humanoid' }]));
    assert.deepEqual(hits, []);
  });
  await test('a high score without 2 shared title terms passes', async () => {
    assert.deepEqual(await findDuplicates(root, NEW_TITLE, fake([{ ...T839, title: 'Deposits: the rig drives through them' }])), []);
  });
  await test('a closed or superseded match never refuses', async () => {
    assert.deepEqual(await findDuplicates(root, NEW_TITLE, fake([{ ...T839, status: 'superseded' }, { ...T839, id: 'ST-T1', status: 'done' }])), []);
  });
  await test('only the top 3 are listed, best first', async () => {
    const rows = [1, 2, 3, 4].map((n) => ({ ...T839, id: `ST-T${n}`, score: DEDUP_SCORE + 10 - n }));
    assert.deepEqual((await findDuplicates(root, NEW_TITLE, fake(rows))).map((h) => h.id), ['ST-T1', 'ST-T2', 'ST-T3']);
  });
  await test('a cache-less answer (no score) and a query error both fail open', async () => {
    assert.deepEqual(await findDuplicates(root, NEW_TITLE, fake([{ ...T839, score: undefined }])), []);
    assert.deepEqual(await findDuplicates(root, NEW_TITLE, async () => { throw new Error('boom'); }), []);
  });
  await test('--not-dup ids are written into the new ticket Notes', () => {
    const { path } = scaffoldNew(root, 'bug', 'Something distinct', { notDup: ['ST-T839', 'ST-T868'] });
    assert.match(readFileSync(path, 'utf8'), /## Notes\nChecked as possible duplicates[^\n]*--not-dup\): ST-T839, ST-T868/);
  });
  await test('without --not-dup the ticket has no Notes section', () => {
    assert.doesNotMatch(readFileSync(scaffoldNew(root, 'bug', 'Another distinct thing').path, 'utf8'), /## Notes/);
  });
  await test('CLI: --not-dup reaches the Notes of a ticket made by `t new`', () => {
    const r = spawnSync('node', [fileURLToPath(new URL('./t.mjs', import.meta.url)), 'new', 'bug', 'Cli made ticket', '--not-dup', 'A-T1,A-T2', '--root', root],
      { encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: tmp } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(join(root, r.stdout.match(/-> (\S+)/)[1]), 'utf8'), /--not-dup\): A-T1, A-T2/);
  });
  if (await resolveEngine()) {
    await test('the real q cache returns a numeric score for `similar` and the gate reads it', async () => {
      const dbPath = join(tmp, 'cache.db');
      writeFileSync(join(root, '.ai', 'tickets', 'TDD-T900-sim.md'),
        '---\nid: TDD-T900\ntitle: sim tick cost along the round trip is reported\ntype: bug\nstatus: todo\n---\n## Description\nsim tick cost\n');
      assert.ok((await hydrate({ root, dbPath })).ok);
      const { rows } = await query('similar', ['--store', 'tickets', '--scopes', 'TDD', 'sim tick cost round trip'], { root, dbPath });
      assert.equal(typeof rows[0].score, 'number');
      assert.deepEqual(await findDuplicates(root, 'sim tick cost round trip', (c, a, o) => query(c, a, { ...o, dbPath })), []);
    });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nt-dedup: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
