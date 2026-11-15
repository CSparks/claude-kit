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
  const COUNTRYSIDE = { title: 'The countryside is built per its plan: regional farming character, ditches before streams, wild land beyond the roads; it starts after the ground work' };
  const UNRELATED = [
    { id: 'DDD-D039', title: 'Roads are routed by traversal difficulty: the path search costs each move by how hard the ground is to cross, so roads follow valleys and passes and switchback up mountains' },
    { id: 'DDD-D081', title: 'The one road network is built per the plan: designed street heights, join patching frozen, gates and corridors switched first' },
    { id: 'DDD-D049', title: 'The volume terrain mesher is built by the seed-and-remesh route: steps 1 to 3 first, then a report; irregularity starts at 0.45' },
  ];
  const scored = (scores) => UNRELATED.map((d, n) => ({ ...d, status: '', score: scores[n] }));

  await test('KIT-T1233: unrelated decisions sharing built, plan, roads, starts and first are never refused, at the scores the title alone gave', async () => {
    const v = await dedupVerdict(root, COUNTRYSIDE, {}, fake(scored([19.3, 17.1, 15.8])));
    assert.equal(v.refusal, '');
  });
  await test('KIT-T1233: nor at the inflated scores a long query gave them (43, 38, 36): shared generic words count for nothing', async () => {
    const hits = await decisionHits(root, COUNTRYSIDE, fake(scored([42.7, 38.1, 35.7])));
    assert.ok(hits.every((h) => !h.near), JSON.stringify(hits));
    assert.equal((await dedupVerdict(root, COUNTRYSIDE, {}, fake(scored([42.7, 38.1, 35.7])))).refusal, '');
  });
  await test('KIT-T1233: the pause-and-launch ruling against the while-away rule is listed at most, never refused', async () => {
    const away = { id: 'DDD-D032', status: '', score: 44, title: 'While Chris is away (from 2026-11-12 evening) work does not stop; questions wait for his announced return' };
    const v = await dedupVerdict(root, { title: 'Chris is shown a launch check first: work stops until the demo starts' }, {}, fake([away]));
    assert.equal(v.refusal, '');
  });
  await test('KIT-T1233: the real re-recorded road ruling stays refused, and only the title is searched', async () => {
    const seen = [];
    const spy = async (command, args) => { seen.push(args); return { rows: [D046], cached: true }; };
    const v = await dedupVerdict(root, { ...RULING, summary: 'a long summary that would lift every bm25 score on its own words' }, {}, spy);
    assert.match(v.refusal, /DDD-D046/);
    assert.equal(seen[0].at(-1), RULING.title);
  });
  await test('KIT-T1233: words most titles of a store hold are not subject words, so a pair sharing only them is listed, not refused', async () => {
    const big = join(tmp, 'big');
    mkdirSync(join(big, '.ai', 'decisions'), { recursive: true });
    writeFileSync(join(big, '.ai', 'config.yml'), 'ids:\n  key: "BBB"\n  pad: 3\n');
    for (let n = 1; n <= 24; n++) writeFileSync(join(big, '.ai', 'decisions', `BBB-D${100 + n}-x.md`), `---\nid: BBB-D${100 + n}\ntitle: Terrain ${n % 2 ? 'alpha' : 'beta'} gamma${n} rule\n---\n`);
    const row = { id: 'BBB-D101', status: '', score: 50, title: 'Terrain alpha mesh pipeline stages' };
    const proposal = { title: 'Terrain alpha shader pipeline budget' };
    assert.equal((await decisionHits(big, proposal, fake([row])))[0].near, false, 'terrain and alpha are common to this store');
    assert.equal((await decisionHits(root, proposal, fake([row])))[0].near, true, 'control: in a small store they are subject words');
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
