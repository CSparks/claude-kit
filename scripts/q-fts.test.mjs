#!/usr/bin/env node
// Tests for q fts retrieval beyond the strict AND match (KIT-T311): a query no item answers in
// full is retried with any term, on the cache and on the markdown scan, and the code-index side
// of fts prints doc lines for a phrase that lives in a doc, not in an item.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { hydrate } from './hydrate-db.mjs';
import { query } from './q-lib.mjs';
import { ftsAnyQuery, splitFts } from './q-model.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const tmp = mkdtempSync(join(tmpdir(), 'kit-qfts-'));
const root = join(tmp, 'proj');
const dbPath = join(tmp, '.cache', 'workflow.db');
mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: "FTQ"\n  pad: 3\n');
const ticket = (n, title, body) => writeFileSync(join(root, '.ai', 'tickets', `FTQ-T00${n}-x.md`),
  `---\nid: FTQ-T00${n}\ntitle: ${title}\ntype: bug\nstatus: todo\npriority: high\n---\n## Description\n${body}\n`);
ticket(1, 'perf tuning lever', 'tuning the perf lever');
ticket(2, 'parallel agents', 'qwen runs the agents in parallel');
mkdirSync(join(root, '.ai', 'decisions'), { recursive: true });
writeFileSync(join(root, '.ai', 'decisions', 'FTQ-D001-voice.md'),
  '---\nid: FTQ-D001\ntitle: The voice has virtual gears\nsummary: stepped sweep\ndate: 2026-10-10\nsource: Chris, a questionnaire\n---\n\n**Decision:** The voice has 3-4 virtual gears and sweeps rpm per gear.\n\n**Why:** the note never returns to idle. Rejected: keep no gearbox at all; a CVT pull-back.\n');
assert.ok((await hydrate({ root, dbPath })).ok, 'fixture hydrates');

const fts = (args, opts = {}) => query('fts', args, { root, dbPath, ...opts });
const ids = (r) => r.rows.map((x) => x.id).sort();

await test('ftsAnyQuery ORs the quoted terms; one term keeps the strict form', () => {
  assert.equal(ftsAnyQuery('parallel agents throughput qwen'), '"parallel" OR "agents" OR "throughput" OR "qwen"');
  assert.equal(ftsAnyQuery('gate'), '"gate"');
  assert.equal(ftsAnyQuery(''), '""');
});

await test('splitFts reads --any and leaves it out of the query', () =>
  assert.deepEqual(splitFts('--any a b'), { scopeTok: undefined, query: 'a b', limit: 25, any: true }));

await test('the logged long queries answer with the items holding some terms', async () => {
  const r = await fts(['parallel', 'agents', 'throughput', 'qwen']);
  assert.equal(r.relaxed, true);
  assert.deepEqual(ids(r), ['FTQ-T002']);
  const perf = await fts(['perf', 'tuning', 'lever', 'campaign']);
  assert.equal(perf.relaxed, true);
  assert.deepEqual(ids(perf), ['FTQ-T001']);
});

await test('a query some item answers in full is not flagged relaxed', async () => {
  const r = await fts(['perf', 'tuning', 'lever']);
  assert.equal(r.relaxed, undefined);
  assert.deepEqual(ids(r), ['FTQ-T001']);
});

await test('a query no term of which matches stays empty', async () => {
  const r = await fts(['zzzunheardof', 'qqqunheardof']);
  assert.equal(r.relaxed, undefined);
  assert.deepEqual(r.rows, []);
});

await test('the markdown scan relaxes the same way', async () => {
  const r = await fts(['parallel', 'agents', 'throughput', 'qwen'], { noDb: true });
  assert.equal(r.relaxed, true);
  assert.deepEqual(ids(r), ['FTQ-T002']);
});

await test('a decision hit shows the Decision line, never the rejected option the query matched (KIT-T721)', async () => {
  const r = await fts(['keep', 'no', 'gearbox']);
  const hit = r.rows.find((x) => x.id === 'FTQ-D001');
  assert.ok(hit, 'the decision matches on its rejected option');
  assert.match(hit.hit, /^Decision: The voice has 3-4 virtual gears/);
  assert.doesNotMatch(hit.hit, /gearbox/);
  assert.equal(hit.body, undefined, 'the body column is not printed');
});

await test('negative: a ticket hit keeps its match window', async () => {
  const r = await fts(['perf', 'tuning', 'lever']);
  assert.match(r.rows[0].hit, /\[perf\]|\[tuning\]|\[lever\]/);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\nq-fts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
