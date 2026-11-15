#!/usr/bin/env node
// t-decide-dedup.test.mjs — `t decide` searches earlier decisions before writing (KIT-T1225): related ones print,
// a near-duplicate refuses unless superseded or named in --not-dup. Scores are the real bm25 values measured on the
// road-generator store: the title of a re-recorded ruling against its original scores 39.4, a related decision 27.9.
// Run: node scripts/t-decide-dedup.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEngine } from './db-engine.mjs';
import { hydrate } from './hydrate-db.mjs';
import { query } from './q-lib.mjs';
import { LISTED, NEAR_SCORE, dedupVerdict, decisionHits } from './t-decide-dedup.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const tmp = mkdtempSync(join(tmpdir(), 'kit-decdedup-'));
const root = join(tmp, 'p');
mkdirSync(join(root, '.ai', 'decisions'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: "DDD"\n  pad: 3\n');
const fake = (rows) => async () => ({ rows, cached: true });

const RULING = { title: 'Every inch of road belongs to one integrated road system; no road meets another un-joined, and no terrain comes through a road' };
const D046 = { id: 'DDD-D046', status: '', score: 39.36, title: 'Streets and highways are one deeply integrated road system: they always know about each other' };
const D023 = { id: 'DDD-D023', status: '', score: 27.94, title: 'Form follows function: road and interchange geometry is derived from what traffic must do, and is verified from data' };

try {
  await test('the re-recorded ruling is refused, naming the earlier decision and the three ways out', async () => {
    const v = await dedupVerdict(root, RULING, {}, fake([D046, D023]));
    assert.match(v.refusal, /refusing — DDD-D046 look\(s\) like the same ruling/);
    assert.match(v.refusal, /--supersedes <id>[\s\S]*--not-dup <id,\.\.\.>/);
    assert.match(v.lines.join('\n'), /DDD-D046 \[near-duplicate\] Streets and highways/);
  });
  await test('a related but different decision is printed and never refuses', async () => {
    const v = await dedupVerdict(root, { title: 'road geometry follows what traffic must do' }, {}, fake([D023]));
    assert.equal(v.refusal, '');
    assert.match(v.lines.join('\n'), /DDD-D023 Form follows function/);
    assert.doesNotMatch(v.lines.join('\n'), /near-duplicate/);
  });
  await test('--not-dup, --supersedes and the draft\'s own supersedes each clear the refusal and still print the match', async () => {
    for (const [opts, draft] of [[{ notDup: ['DDD-D046'] }, RULING], [{ supersedes: 'DDD-D046' }, RULING], [{}, { ...RULING, supersedes: 'DDD-D046' }]]) {
      const v = await dedupVerdict(root, draft, opts, fake([D046]));
      assert.equal(v.refusal, '');
      assert.match(v.lines.join('\n'), /DDD-D046/);
    }
  });
  await test('control: naming another id does not clear it', async () => {
    assert.notEqual((await dedupVerdict(root, RULING, { notDup: ['DDD-D001'] }, fake([D046]))).refusal, '');
  });
  await test('a superseded or rejected decision, a weak score and a single shared term never match', async () => {
    const hits = await decisionHits(root, RULING, fake([
      { ...D046, status: 'superseded' }, { ...D046, id: 'DDD-D2', status: 'rejected' },
      { ...D046, id: 'DDD-D3', score: 9.5 }, { ...D046, id: 'DDD-D4', title: 'Terrain streaming budget' },
    ]));
    assert.deepEqual(hits, []);
  });
  await test('a score under the near line with three shared terms is listed, not refused', async () => {
    const hits = await decisionHits(root, RULING, fake([{ ...D046, score: NEAR_SCORE - 1 }]));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].near, false);
  });
  await test('at most LISTED decisions print, best first', async () => {
    const rows = Array.from({ length: LISTED + 3 }, (_, n) => ({ ...D046, id: `DDD-D${100 + n}`, score: NEAR_SCORE + 10 - n }));
    assert.equal((await decisionHits(root, RULING, fake(rows))).length, LISTED);
  });
  await test('an empty store, a score-less answer and a query error all let the write through', async () => {
    assert.deepEqual(await dedupVerdict(root, RULING, {}, fake([])), { lines: [], refusal: '' });
    assert.equal((await dedupVerdict(root, RULING, {}, fake([{ ...D046, score: undefined }]))).refusal, '');
    assert.equal((await dedupVerdict(root, RULING, {}, async () => { throw new Error('boom'); })).refusal, '');
  });
  await test('CLI: with no earlier decision the draft is written and nothing is refused', () => {
    const file = join(tmp, 'draft.md');
    writeFileSync(file, '---\ntitle: First ruling\nsource: research/x.md\n---\n\n**Decision:** Ship it.\n\n**Why:** Needed.\n');
    const r = spawnSync(process.execPath, [fileURLToPath(new URL('./t.mjs', import.meta.url)), 'decide', '--file', file, '--root', root, '--no-work', 'a standing rule'], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmp, 'none.json') } });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(readdirSync(join(root, '.ai', 'decisions')).some((f) => f.includes('first-ruling')));
  });
  if (await resolveEngine()) {
    await test('the real q cache answers `similar --store decisions` with a numeric score the check reads', async () => {
      const store = join(tmp, 'real');
      mkdirSync(join(store, '.ai', 'decisions'), { recursive: true });
      writeFileSync(join(store, '.ai', 'config.yml'), 'ids:\n  key: "RRR"\n  pad: 3\n');
      writeFileSync(join(store, '.ai', 'decisions', 'RRR-D046-streets-and-highways.md'), `---\nid: RRR-D046\ntitle: ${D046.title}\nsource: research/x.md\n---\n\n**Decision:** one system.\n\n**Why:** Needed.\n`);
      const dbPath = join(tmp, 'real.db');
      assert.ok((await hydrate({ root: store, dbPath })).ok);
      const q = (command, args, options) => query(command, args, { ...options, dbPath });
      const { rows } = await q('similar', ['--store', 'decisions', '--scopes', 'RRR', RULING.title], { root: store });
      assert.equal(typeof rows[0].score, 'number');
      assert.equal(rows[0].id, 'RRR-D046');
      assert.ok(Array.isArray(await decisionHits(store, RULING, q)));
    });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nt-decide-dedup: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
