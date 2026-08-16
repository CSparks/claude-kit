#!/usr/bin/env node
// Tests for the q query surface — the four live failures agents hit on the interface the
// query-gate FORCES them onto instead of grep:
//   KIT-T172  `fts` sent user terms to FTS5 MATCH raw, so `fts "no ask-first gate"` died
//             with `no such column: first` (the hyphen parsed as FTS5 syntax).
//   KIT-T173  `trail <id>` had no origin row, so any id with no outbound antecedents — every
//             decision the orient banner advertises — answered "(no results)".
//   KIT-T174  `fts` had no scope filter, so a search inside one project returned every other
//             project's hits and none of its own.
//   KIT-T118  `--help` / `-h` / `help` exited 1 as an unknown query while the query-gate's
//             own block message sends agents to `q.mjs --help`. (Also KIT-T083, same ask.)
//
// ISOLATION (KIT-T142/T164): every fixture uses a synthetic ids.key, every in-process query
// takes an explicit `dbPath` under a temp dir, and every CLI child runs with
// CLAUDE_PLUGIN_ROOT + --root pointed at temp dirs. Nothing here can reach ~/.claude or
// rewrite a live project's scope in the shared cache.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { resolveEngine } from './db-engine.mjs';
import { hydrate } from './hydrate-db.mjs';
import { query } from './q.mjs';
import { ftsMatchQuery, parseFts, defaultScope, resolveStore, requireStore, requireScope, formatId } from './q-model.mjs';
import { parseInboxArgs, ageDays, inboxRows, CONFIRMATION_DAYS } from './q-inbox.mjs';

const Q_CLI = join(dirname(fileURLToPath(import.meta.url)), 'q.mjs');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

// ---- fixtures ---------------------------------------------------------------
// TWO adopted projects so the scope filter has something to filter OUT — the KIT-T174 bug was
// only visible cross-scope. Both carry the same searchable words on purpose.
const tmpRoot = mkdtempSync(join(tmpdir(), 'kit-q-'));
const pluginRoot = join(tmpRoot, 'plugin');       // CLAUDE_PLUGIN_ROOT for CLI children
const dbPath = join(tmpRoot, '.cache', 'workflow.db');

function makeProject(name, key) {
  const root = join(tmpRoot, name);
  const ai = join(root, '.ai');
  for (const store of ['tickets', 'decisions', 'notes', 'questions', 'inbox']) {
    mkdirSync(join(ai, store), { recursive: true });
  }
  writeFileSync(join(ai, 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
  return { root, ai };
}

const A = makeProject('proj-a', 'FQA');
// T001: the hyphenated-phrase target. `ask-first` is the exact shape that crashed MATCH.
writeFileSync(join(A.ai, 'tickets', 'FQA-T001-gate.md'),
  `---\nid: FQA-T001\ntitle: no ask-first gate on captures\ntype: bug\nstatus: todo\npriority: high\n---\n## Description\nthe ask-first gate blocks widget capture\n`);
// T002: has ancestors (parent + a linked decision) — the trail walk with an origin row.
writeFileSync(join(A.ai, 'tickets', 'FQA-T002-child.md'),
  `---\nid: FQA-T002\ntitle: child of the gate ticket\ntype: feature\nstatus: doing\npriority: medium\nparent: FQA-T001\nlinks: [FQA-D001]\n---\n## Description\nchild work on the gate\n`);
// D001: a DECISION with no outbound antecedents at all — the KIT-T173 repro shape.
writeFileSync(join(A.ai, 'decisions', 'FQA-D001.md'),
  `---\nid: FQA-D001\ntitle: Always make tickets in this repo - no ask-first gate\ndate: 2026-08-04\n---\n**Decision:** capture first, ask never\n`);

// N001 + Q001 exist ONLY so next-id has a live counter in every store (KIT-T183). Their text
// deliberately shares no term with the FTS fixtures above, so the scope/MATCH assertions that
// count hits stay untouched.
writeFileSync(join(A.ai, 'notes', 'FQA-N001.md'),
  `---\nid: FQA-N001\ntitle: scan ordering memo\n---\nthe markdown scan sorts by id\n`);
writeFileSync(join(A.ai, 'questions', 'FQA-Q001.md'),
  `---\nid: FQA-Q001\ntitle: which pad width for this project\nstatus: open\n---\nthree digits?\n`);

const B = makeProject('proj-b', 'FQB');
writeFileSync(join(B.ai, 'tickets', 'FQB-T001-other.md'),
  `---\nid: FQB-T001\ntitle: another project's ask-first gate note\ntype: bug\nstatus: todo\npriority: low\n---\n## Description\nthe gate and the widget again\n`);

// KIT-T238 inbox fixtures: id-less caps in cap.mjs's own `YYYY-MM-DD-HHMM-slug.md` shape, aged
// by their filename stamp. Their words are deliberately disjoint from the FTS fixtures above so
// the scope/MATCH hit-count assertions stay untouched.
const DAY_MS = 86400000;
// Name each cap from ONE instant so its filename stamp is EXACTLY N days back — a date-only
// stamp would round to N±1 depending on the hour the suite runs.
const capName = (daysAgo, slug) => {
  const iso = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}-${slug}.md`;
};
const OLD_CAP = capName(9, 'harvester-throughput-drops');
const FRESH_CAP = capName(0, 'seed-a-fresh-observation');
writeFileSync(join(A.ai, 'inbox', OLD_CAP), '(bug) harvester throughput drops after a reload\n');
writeFileSync(join(A.ai, 'inbox', FRESH_CAP), '(idea) seed a fresh observation\n');
writeFileSync(join(B.ai, 'inbox', capName(30, 'other-project-capture')), '(chore) other project capture\n');

// ---- KIT-T172: the MATCH-expression builder (pure, always runs) --------------
test('ftsMatchQuery quotes a hyphenated term into a phrase (no bare `first` column ref)', () =>
  assert.equal(ftsMatchQuery('no ask-first gate'), '"no" "ask-first" "gate"'));
test('ftsMatchQuery doubles an embedded double-quote (never breaks out of the string)', () =>
  assert.equal(ftsMatchQuery('foo"bar'), '"foo""bar"'));
test('ftsMatchQuery neutralizes column-ref / operator punctuation', () =>
  assert.equal(ftsMatchQuery('a:b (c)'), '"a:b" "(c)"'));
test('ftsMatchQuery preserves a trailing * as a prefix search', () =>
  assert.equal(ftsMatchQuery('widget*'), '"widget"*'));
test('ftsMatchQuery keeps UPPERCASE booleans as operators', () =>
  assert.equal(ftsMatchQuery('widget OR gate'), '"widget" OR "gate"'));
test('ftsMatchQuery quotes a LOWERCASE and/or (a term to FTS5, not an operator)', () =>
  assert.equal(ftsMatchQuery('gate and widget'), '"gate" "and" "widget"'));
test('ftsMatchQuery drops dangling/doubled operators (each is a syntax error alone)', () => {
  assert.equal(ftsMatchQuery('OR widget AND'), '"widget"');
  assert.equal(ftsMatchQuery('a OR OR b'), '"a" OR "b"');
});
test('ftsMatchQuery passes a caller-quoted phrase through untouched', () =>
  assert.equal(ftsMatchQuery('say "hi there" now'), '"say" "hi there" "now"'));
test('ftsMatchQuery returns the matches-nothing query for empty/punctuation-only input', () => {
  assert.equal(ftsMatchQuery(''), '""');
  assert.equal(ftsMatchQuery('--- ...'), '""');
});

// ---- KIT-T174: the scope split (pure, always runs) ---------------------------
test('defaultScope resolves an adopted repo root to its ids.key', () =>
  assert.equal(defaultScope(A.root), 'FQA'));
test('defaultScope walks UP from a subdirectory of the repo', () =>
  assert.equal(defaultScope(join(A.root, '.ai', 'tickets')), 'FQA'));
test('parseFts defaults the scope to the cwd project and strips the flag from the terms', () =>
  assert.deepEqual(parseFts('ask-first gate', A.root), { scope: 'FQA', query: 'ask-first gate' }));
test('parseFts honors an explicit --scope, wherever it sits in the args', () => {
  assert.deepEqual(parseFts('--scope FQB gate', A.root), { scope: 'FQB', query: 'gate' });
  assert.deepEqual(parseFts('gate --scope FQB', A.root), { scope: 'FQB', query: 'gate' });
});
test('parseFts treats --scope all as no filter (case-insensitive)', () => {
  assert.deepEqual(parseFts('--scope all gate', A.root), { scope: '', query: 'gate' });
  assert.deepEqual(parseFts('--scope ALL gate', A.root), { scope: '', query: 'gate' });
});
test('parseFts falls back to every scope outside an adopted repo', () =>
  assert.deepEqual(parseFts('gate', tmpRoot), { scope: '', query: 'gate' }));

// ---- KIT-T238: the inbox arg/age model (pure, always runs) ------------------
test('parseInboxArgs defaults the scope to the cwd project', () =>
  assert.deepEqual(parseInboxArgs([], A.root), { scope: 'FQA', olderThanDays: 0 }));
test('parseInboxArgs takes an explicit scope, and `all` means every project', () => {
  assert.equal(parseInboxArgs(['FQB'], A.root).scope, 'FQB');
  assert.equal(parseInboxArgs(['all'], A.root).scope, '');
});
test('parseInboxArgs reads --older-than in days or hours, anywhere in the args', () => {
  assert.deepEqual(parseInboxArgs(['--older-than', '3d'], A.root), { scope: 'FQA', olderThanDays: 3 });
  assert.deepEqual(parseInboxArgs(['FQB', '--older-than', '7'], A.root), { scope: 'FQB', olderThanDays: 7 });
  assert.equal(parseInboxArgs(['--older-than=12h'], A.root).olderThanDays, 0.5);
});
test('parseInboxArgs refuses a duration it cannot parse (never a silent no-filter)', () =>
  assert.throws(() => parseInboxArgs(['--older-than', 'lately'], A.root), /wants a duration/));
test('ageDays reads the capture date out of the filename', () => {
  const now = Date.UTC(2026, 7, 15);
  assert.equal(Math.floor(ageDays('inbox/2026-08-12-0900-thing.md', null, now)), 2);
});
test('ageDays falls back to the file mtime when the name carries no date', () => {
  const now = Date.UTC(2026, 7, 15);
  assert.equal(Math.floor(ageDays('inbox/undated.md', now - 5 * DAY_MS, now)), 5);
  assert.equal(ageDays('inbox/undated.md', null, now), null, 'no signal at all is unknown, not zero');
});
test('inboxRows filters by age and prints an openable path', () => {
  const now = Date.UTC(2026, 7, 15);
  const items = [
    { id: 'X-INBOX-a', scope: 'X', file: 'inbox/2026-08-01-0900-old.md', body: '(bug) old thing' },
    { id: 'X-INBOX-b', scope: 'X', file: 'inbox/2026-08-15-0900-new.md', body: '(idea) new thing' },
  ];
  const rows = inboxRows(items, { now, olderThanDays: 3, aiDirFor: () => '/data/.ai' });
  assert.deepEqual(rows.map((r) => r.id), ['X-INBOX-a'], 'only the aged capture survives the filter');
  assert.equal(rows[0].age, '13d', 'whole days elapsed since the 09:00 capture stamp');
  assert.equal(rows[0].type, '', 'the row carries whatever type the parse found');
  assert.equal(rows[0].title, 'old thing', 'an id-less cap is summarized from its body, minus the (type) tag');
  assert.match(rows[0].path, /inbox[\\/]2026-08-01-0900-old\.md$/);
});
test('inboxRows sorts oldest first (the confirmation queue reads top-down)', () => {
  const now = Date.UTC(2026, 7, 15);
  const rows = inboxRows([
    { id: 'b', scope: 'X', file: 'inbox/2026-08-14-0900-b.md' },
    { id: 'a', scope: 'X', file: 'inbox/2026-08-01-0900-a.md' },
  ], { now });
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b']);
});

// ---- KIT-T183 / KIT-T109: the next-id store argument (pure, always runs) ----
// The lenient predecessor mapped ANY unrecognized store name to `tickets`, so `next-id GB
// decision` answered with the ticket counter under a `GB-decision46` id, and an omitted store
// produced `GB-undefined46`. Both minted an id that collides with real work.
const STORE_LETTER = { tickets: 'T', decisions: 'D', notes: 'N', questions: 'Q', requests: 'R', epics: 'E' };
for (const [store, letter] of Object.entries(STORE_LETTER)) {
  test(`requireStore accepts every name for ${store} (plural / singular / ${letter})`, () => {
    assert.equal(requireStore(store), store);
    assert.equal(requireStore(store.replace(/s$/, '')), store, 'the singular a caller naturally types');
    assert.equal(requireStore(letter), store, 'the id letter');
    assert.equal(requireStore(letter.toLowerCase()), store, 'case-insensitive');
  });
  test(`formatId stamps ${store} with its own letter ${letter}`, () =>
    assert.equal(formatId(A.root, 'FQA', store, 7), `FQA-${letter}007`));
}
test('resolveStore reports an unknown name instead of guessing tickets', () => {
  assert.equal(resolveStore('bogus'), null);
  assert.equal(resolveStore(''), null);
  assert.equal(resolveStore(undefined), null);
});
test('requireStore refuses an unknown store, naming the ones that exist', () => {
  assert.throws(() => requireStore('bogus'), /unknown store 'bogus'.*tickets \| decisions/s);
  assert.throws(() => requireStore(undefined), /a store is required.*decisions/s);
});
test('requireScope refuses a missing scope (it used to reach SQLite as a bound param)', () => {
  assert.equal(requireScope('FQA'), 'FQA');
  assert.throws(() => requireScope(undefined), /a scope is required/);
  assert.throws(() => requireScope('  '), /a scope is required/);
});

// ---- KIT-T118: --help is a working exit-0 discovery route (always runs) ------
// The query-gate block message points agents at `q.mjs --help`; if that errors they have no
// discovery route at all. No DB is touched on this path, but the child still gets an isolated
// CLAUDE_PLUGIN_ROOT so a regression that DID open the cache can never hit the live one.
const cli = (args) => spawnSync(process.execPath, [Q_CLI, ...args], {
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
});

for (const flag of ['--help', '-h', 'help']) {
  test(`q ${flag} exits 0 and prints the query surface to stdout`, () => {
    const r = cli([flag]);
    assert.equal(r.status, 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr.trim()})`);
    assert.match(r.stdout, /^usage: q\.mjs /, 'the surface goes to STDOUT, not stderr');
    assert.equal(r.stderr.trim(), '', 'nothing on stderr on the help path');
  });
}
test('q --help lists every verb the CLI actually dispatches', () => {
  const { stdout } = cli(['--help']);
  for (const verb of ['open', 'inbox', 'confirmations', 'children', 'backlinks', 'trail', 'governing', 'mentions', 'drift',
    'by-commit', 'doc-trail', 'fts', 'similar', 'next-id', 'rundown', 'regressions',
    'supersedes', 'integrity', 'sql', 'verify', 'sessions', 'session', 'said']) {
    assert.match(stdout, new RegExp(`^\\s{2}${verb.replace('-', '\\-')}\\b`, 'm'), `--help documents \`${verb}\``);
  }
});
test('q --help documents the fts --scope flag (KIT-T174)', () =>
  assert.match(cli(['--help']).stdout, /fts \[--scope <s>\]/, 'the new flag is discoverable from --help'));
test('a bare `q` still exits 2 with the surface on stderr (usage, not success)', () => {
  const r = cli([]);
  assert.equal(r.status, 2, 'no query = usage error');
  assert.match(r.stderr, /^usage: q\.mjs /);
});

// ---- cache-backed (skipped when no engine) ----------------------------------
const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — the MATCH/scope/trail cache paths need SQLite)');
} else {
  // Two SINGLE-ROOT hydrates into ONE db: the incremental sync keys its manifest per scope, so
  // the second never evicts the first. That is a cross-scope cache built without touching the
  // machine's project registry — the exact shape the KIT-T174 bug lived in.
  await testAsync('fixture: both projects hydrate into one cross-scope db', async () => {
    assert.ok((await hydrate({ root: A.root, dbPath })).ok, 'project A hydrates');
    assert.ok((await hydrate({ root: B.root, dbPath })).ok, 'project B hydrates');
    const { rows } = await query('fts', ['--scope', 'all', 'gate'], { root: A.root, dbPath });
    assert.deepEqual(rows.map((r) => r.id).sort(), ['FQA-D001', 'FQA-T001', 'FQA-T002', 'FQB-T001'],
      'one db holds both scopes');
  });

  const ids = async (args, opts = {}) =>
    (await query('fts', args, { root: A.root, dbPath, ...opts })).rows.map((r) => r.id).sort();

  // ---- KIT-T172 ------------------------------------------------------------
  await testAsync('fts on a HYPHENATED phrase returns rows instead of `no such column: first`', async () => {
    // Both A items carry all three words; the point is that they come back at all — before
    // the fix this query never reached the index, it died parsing `first` as a column.
    assert.deepEqual(await ids(['no ask-first gate']), ['FQA-D001', 'FQA-T001'],
      'the hyphenated phrase is searched, not parsed as FTS5 syntax');
  });
  await testAsync('fts survives punctuation that used to be FTS5 syntax (no throw, clean empty)', async () => {
    for (const q of ['q.mjs --help', 'a:b', '(foo) OR', 'say "hi"', '^caret', 'NEAR(x y, 2)', '-']) {
      const { rows } = await query('fts', [q], { root: A.root, dbPath });
      assert.ok(Array.isArray(rows), `fts ${JSON.stringify(q)} returned rows, not an error`);
    }
  });
  await testAsync('fts prefix search still works after escaping (widget* -> "widget"*)', async () => {
    assert.deepEqual(await ids(['--scope', 'all', 'widg*']), ['FQA-T001', 'FQB-T001']);
  });
  await testAsync('similar (the other FTS-shaped verb) also survives a hyphenated proposal', async () => {
    const { rows } = await query('similar', ['no ask-first gate on captures'], { root: A.root, dbPath });
    assert.ok(rows.some((r) => r.id === 'FQA-T001'), 'the dedup detector still matches, and never throws');
  });

  // ---- KIT-T174 ------------------------------------------------------------
  await testAsync('fts DEFAULTS to the cwd project scope (no more all-projects noise)', async () => {
    assert.deepEqual(await ids(['gate']), ['FQA-D001', 'FQA-T001', 'FQA-T002'],
      "project B's matching ticket is filtered out by the default scope");
  });
  await testAsync('fts --scope <other> confines the search to that project', async () =>
    assert.deepEqual(await ids(['--scope', 'FQB', 'gate']), ['FQB-T001']));
  await testAsync('fts --scope all searches every project', async () =>
    assert.deepEqual(await ids(['--scope', 'all', 'gate']), ['FQA-D001', 'FQA-T001', 'FQA-T002', 'FQB-T001']));
  await testAsync('fts scope filtering is identical on the markdown-scan path (no-engine parity)', async () => {
    assert.deepEqual(await ids(['gate'], { noDb: true }), ['FQA-D001', 'FQA-T001', 'FQA-T002'],
      'the scan defaults to the cwd scope too');
    assert.deepEqual(await ids(['--scope', 'all', 'gate'], { noDb: true }), ['FQA-D001', 'FQA-T001', 'FQA-T002'],
      'the scan only ever sees the root it scanned, so `all` is still that root');
  });

  // ---- KIT-T173 ------------------------------------------------------------
  const trail = async (id, opts = {}) => (await query('trail', [id], { root: A.root, dbPath, ...opts })).rows;

  await testAsync('trail on a DECISION id returns its own row, not "(no results)"', async () => {
    const rows = await trail('FQA-D001');
    assert.equal(rows.length, 1, 'a decision with no antecedents still answers with itself');
    assert.equal(rows[0].id, 'FQA-D001');
    assert.equal(rows[0].store, 'decisions');
    assert.equal(rows[0].rel, 'self');
    assert.equal(rows[0].depth, 0);
    assert.match(rows[0].summary, /no ask-first gate/, 'the row carries the item title/summary');
  });
  await testAsync('trail puts the origin row FIRST, then the ancestors it already walked', async () => {
    const rows = await trail('FQA-T002');
    assert.equal(rows[0].id, 'FQA-T002', 'the queried item leads');
    assert.equal(rows[0].rel, 'self');
    assert.deepEqual(rows.slice(1).map((r) => r.id), ['FQA-D001', 'FQA-T001'],
      'ancestors keep their decisions-first ordering');
    assert.deepEqual(rows.slice(1).map((r) => r.rel), ['link', 'parent']);
  });
  await testAsync('trail on an id the store does NOT have still returns nothing', async () => {
    assert.deepEqual(await trail('FQA-T999'), [], '"(no results)" now means what it says');
  });
  await testAsync('trail origin row is identical on the markdown-scan path', async () => {
    const core = (rows) => rows.map((r) => ({ id: r.id, store: r.store, rel: r.rel, depth: r.depth }));
    assert.deepEqual(core(await trail('FQA-D001', { noDb: true })), core(await trail('FQA-D001')));
    assert.deepEqual(core(await trail('FQA-T002', { noDb: true })), core(await trail('FQA-T002')));
  });

  // ---- KIT-T183: next-id, every store, both paths --------------------------
  const nextId = async (scope, store, opts = {}) =>
    (await query('next-id', [scope, store], { root: A.root, dbPath, ...opts })).rows[0];

  await testAsync('next-id counts EACH store separately — T/D/N/Q never borrow each other\'s counter', async () => {
    // Fixture: 2 tickets, 1 decision, 1 note, 1 question — four different counters.
    assert.deepEqual(await nextId('FQA', 'tickets'), { id: 'FQA-T003', scope: 'FQA', store: 'tickets', num: 3 });
    assert.deepEqual(await nextId('FQA', 'decisions'), { id: 'FQA-D002', scope: 'FQA', store: 'decisions', num: 2 });
    assert.deepEqual(await nextId('FQA', 'notes'), { id: 'FQA-N002', scope: 'FQA', store: 'notes', num: 2 });
    assert.deepEqual(await nextId('FQA', 'questions'), { id: 'FQA-Q002', scope: 'FQA', store: 'questions', num: 2 });
  });
  await testAsync('next-id <scope> decision (singular) is the DECISION counter, not the ticket one', async () => {
    const plural = await nextId('FQA', 'decisions');
    assert.deepEqual(await nextId('FQA', 'decision'), plural, 'the singular resolves to the same store');
    assert.deepEqual(await nextId('FQA', 'D'), plural, 'so does the id letter');
    assert.notEqual(plural.num, (await nextId('FQA', 'tickets')).num, 'the two counters are genuinely different');
  });
  await testAsync('next-id refuses an unknown/absent store instead of minting a ticket id', async () => {
    await assert.rejects(() => nextId('FQA', 'bogus'), /unknown store 'bogus'/);
    await assert.rejects(() => nextId('FQA', undefined), /a store is required/);
    await assert.rejects(() => nextId(undefined, 'tickets'), /a scope is required/);
  });
  await testAsync('next-id is identical on the markdown-scan path for every store', async () => {
    for (const store of ['tickets', 'decisions', 'notes', 'questions']) {
      assert.deepEqual(await nextId('FQA', store, { noDb: true }), await nextId('FQA', store),
        `${store}: cache and scan must agree`);
    }
  });
  await testAsync('next-id on the scan path REFUSES a scope it cannot see (no more <SCOPE>-D001)', async () => {
    // The scan only ever opens ONE root. Counting FQB from inside FQA used to return FQB-T001
    // over a store that already holds FQB-T001 — an allocation straight onto live work.
    await assert.rejects(() => nextId('FQB', 'tickets', { noDb: true }), /cannot see scope FQB/);
    assert.equal((await nextId('FQB', 'tickets')).id, 'FQB-T002', 'the cache, which holds both scopes, answers fine');
  });
  await testAsync('CLI: the KIT-T183 repro prints a D id and exits 0; a bogus store exits non-zero', async () => {
    const good = cli(['--root', A.root, 'next-id', 'FQA', 'decision']);
    assert.equal(good.status, 0, `exited ${good.status}: ${good.stderr.trim()}`);
    assert.match(good.stdout, /^FQA-D002\b/m, 'the singular store name prints the decision id');
    assert.doesNotMatch(good.stdout, /FQA-decision|undefined/, 'no bogus id segment survives');

    const bad = cli(['--root', A.root, 'next-id', 'FQA', 'bogus']);
    assert.notEqual(bad.status, 0, 'an unknown store is an error, not an id');
    assert.match(bad.stderr, /unknown store 'bogus'/);
  });

  // ---- KIT-T238: the inbox verbs, cache + scan + CLI -----------------------
  const inbox = async (args, opts = {}) => (await query('inbox', args, { root: A.root, dbPath, ...opts })).rows;

  await testAsync('inbox lists this project\'s untriaged captures, oldest first', async () => {
    const rows = await inbox([]);
    assert.deepEqual(rows.map((r) => r.path.split(/[\\/]/).pop()), [OLD_CAP, FRESH_CAP]);
    assert.equal(rows[0].scope, 'FQA', "another project's capture is not in the default scope");
    assert.equal(rows[0].age, '9d');
    assert.equal(rows[0].type, 'bug', "the cap's leading (type) tag is carried through");
    assert.equal(rows[0].title, 'harvester throughput drops after a reload');
  });
  await testAsync('inbox --older-than drops the fresh captures (no more ad-hoc SQL for age)', async () => {
    assert.deepEqual((await inbox(['--older-than', '3d'])).map((r) => r.age), ['9d']);
    assert.deepEqual(await inbox(['--older-than', '30d']), [], 'nothing is that old yet');
  });
  await testAsync('inbox <scope> / all cross the project boundary explicitly', async () => {
    assert.deepEqual((await inbox(['FQB'])).map((r) => r.scope), ['FQB']);
    assert.deepEqual((await inbox(['all'])).map((r) => r.scope), ['FQB', 'FQA', 'FQA'], 'oldest first across scopes');
  });
  await testAsync('inbox rows carry a REAL path — the file the row names exists on disk', async () => {
    const [row] = await inbox([]);
    assert.ok(existsSync(row.path), `${row.path} should be openable`);
  });
  await testAsync(`confirmations is inbox filtered to >= ${CONFIRMATION_DAYS}d (the needs-a-human set)`, async () => {
    const { rows } = await query('confirmations', [], { root: A.root, dbPath });
    assert.deepEqual(rows.map((r) => r.age), ['9d']);
    assert.deepEqual(rows, await inbox(['--older-than', `${CONFIRMATION_DAYS}d`]), 'same data, one fixed filter');
  });
  await testAsync('inbox is identical on the markdown-scan path (no-engine parity)', async () => {
    const core = (rows) => rows.map((r) => ({ id: r.id, age: r.age, scope: r.scope, title: r.title }));
    assert.deepEqual(core(await inbox([], { noDb: true })), core(await inbox([])));
    assert.deepEqual(core(await inbox(['--older-than', '3d'], { noDb: true })), core(await inbox(['--older-than', '3d'])));
  });
  await testAsync('CLI: q inbox / q confirmations exit 0 and print the path', async () => {
    const r = cli(['--root', A.root, 'inbox']);
    assert.equal(r.status, 0, `inbox exited ${r.status}: ${r.stderr.trim()}`);
    assert.match(r.stdout, new RegExp(OLD_CAP.replace(/\./g, '\\.')), 'the row names the file');
    const c = cli(['--root', A.root, 'confirmations', '--json']);
    assert.equal(c.status, 0, `confirmations exited ${c.status}: ${c.stderr.trim()}`);
    assert.equal(JSON.parse(c.stdout).length, 1, 'JSON output is machine-readable');
  });

  // ---- end-to-end through the CLI (the literal repro commands) --------------
  await testAsync('CLI: the KIT-T172 + KIT-T173 repro commands both exit 0 with output', async () => {
    const fts = cli(['--root', A.root, 'fts', 'no ask-first gate']);
    assert.equal(fts.status, 0, `fts exited ${fts.status}: ${fts.stderr.trim()}`);
    assert.match(fts.stdout, /FQA-T001/, 'the hyphenated search prints a hit');
    assert.doesNotMatch(fts.stderr, /no such column/, 'the FTS5 column-ref crash is gone');

    const tr = cli(['--root', A.root, 'trail', 'FQA-D001']);
    assert.equal(tr.status, 0, `trail exited ${tr.status}: ${tr.stderr.trim()}`);
    assert.match(tr.stdout, /FQA-D001\s+decisions\s+self/, 'trail prints the decision, not "(no results)"');
  });
}

rmSync(tmpRoot, { recursive: true, force: true });

console.log(`\nq: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
