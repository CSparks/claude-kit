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

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { resolveEngine } from './db-engine.mjs';
import { hydrate } from './hydrate-db.mjs';
import { query } from './q.mjs';
import { ftsMatchQuery, parseFts, defaultScope } from './q-model.mjs';

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
  mkdirSync(join(ai, 'tickets'), { recursive: true });
  mkdirSync(join(ai, 'decisions'), { recursive: true });
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

const B = makeProject('proj-b', 'FQB');
writeFileSync(join(B.ai, 'tickets', 'FQB-T001-other.md'),
  `---\nid: FQB-T001\ntitle: another project's ask-first gate note\ntype: bug\nstatus: todo\npriority: low\n---\n## Description\nthe gate and the widget again\n`);

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
  for (const verb of ['open', 'children', 'backlinks', 'trail', 'governing', 'mentions', 'drift',
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
