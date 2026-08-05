#!/usr/bin/env node
// Tests for hooks/context7-ledger.mjs (KIT-T182) — the PostToolUse ledger for metered context7
// calls. Drives the hook the way the harness does (spawnSync, JSON payload on stdin) against a
// throwaway ledger path and a throwaway plugin root, so neither the real ~/.claude ledger nor the
// real research/ index is touched. Asserts: a matching call appends one well-formed row; a
// malformed payload exits 0 and writes nothing; a KB-indexed library warns on stderr.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const HOOK = join(HERE, 'context7-ledger.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// A throwaway plugin root whose research/README.md is the KB index the hook will find first.
const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-c7-root-'));
fixtures.push(PLUGIN_ROOT);
mkdirSync(join(PLUGIN_ROOT, 'research'), { recursive: true });
writeFileSync(join(PLUGIN_ROOT, 'research', 'README.md'), [
  '## Index',
  '| Doc | Topic | Status |',
  '| --- | --- | --- |',
  '| _(none yet — seed by classifying generic findings out of project research)_ | | |',
  '| [Drizzle ORM](lib-drizzle.md) | schema + migrations | 🔬 |',
  '| lib-tanstack-query.md | caching | ✅ |',
  '',
].join('\n'));

function fire(raw, { ledger, pluginRoot = PLUGIN_ROOT } = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: raw,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_KIT_CONTEXT7_LEDGER: ledger },
  });
  return { code: r.status, stderr: r.stderr || '', rows: readLedger(ledger) };
}

function readLedger(path) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function freshLedger() {
  const dir = mkdtempSync(join(tmpdir(), 'kit-c7-ledger-'));
  fixtures.push(dir);
  return join(dir, 'nested', 'context7-ledger.jsonl'); // nested: the hook must mkdir its own dir
}

// 1. A metered call appends exactly one well-formed row.
{
  const ledger = freshLedger();
  const r = fire(JSON.stringify({
    tool_name: 'mcp__plugin_context7_context7__query-docs',
    tool_input: { libraryId: '/vercel/next.js', query: 'app router middleware' },
  }), { ledger });
  ok('metered call: exits 0', r.code === 0, `code=${r.code}`);
  ok('metered call: appends exactly one row', r.rows.length === 1, `rows=${r.rows.length}`);
  const row = r.rows[0] || {};
  ok('row: ISO-UTC ts', /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(row.ts || ''), String(row.ts));
  ok('row: records the tool', row.tool === 'mcp__plugin_context7_context7__query-docs', String(row.tool));
  ok('row: extract carries library AND query',
    /\/vercel\/next\.js/.test(row.query || '') && /app router middleware/.test(row.query || ''), String(row.query));

  // A second call APPENDS (the ledger is a running record, not a last-call snapshot).
  const r2 = fire(JSON.stringify({
    tool_name: 'mcp__plugin_context7_context7__resolve-library-id',
    tool_input: { libraryName: 'Zod', query: 'schema parsing' },
  }), { ledger });
  ok('second call: appends rather than overwrites', r2.rows.length === 2, `rows=${r2.rows.length}`);
  ok('second call: resolve-library-id extract uses libraryName', /Zod/.test(r2.rows[1].query || ''), String(r2.rows[1].query));
}

// 2. Fail-open: malformed / empty payloads exit 0 and write nothing.
for (const [label, raw] of [['garbage', 'not json at all'], ['empty', ''], ['no tool_name', '{}']]) {
  const ledger = freshLedger();
  const r = fire(raw, { ledger });
  ok(`${label} payload: exits 0 (fail-open)`, r.code === 0, `code=${r.code}`);
  ok(`${label} payload: writes no ledger row`, r.rows.length === 0, `rows=${r.rows.length}`);
}

// 3. A non-context7 tool is not our spend — no row.
{
  const ledger = freshLedger();
  const r = fire(JSON.stringify({ tool_name: 'mcp__github__search', tool_input: { query: 'drizzle' } }), { ledger });
  ok('non-context7 tool: exits 0 and writes nothing', r.code === 0 && r.rows.length === 0, `rows=${r.rows.length}`);
}

// 4. KB-index match warns on stderr — and still exits 0 (warn-only, never a block).
{
  const ledger = freshLedger();
  const r = fire(JSON.stringify({
    tool_name: 'mcp__plugin_context7_context7__resolve-library-id',
    tool_input: { libraryName: 'Drizzle ORM', query: 'migrations' },
  }), { ledger });
  ok('KB hit: exits 0 (never blocks)', r.code === 0, `code=${r.code}`);
  ok('KB hit: warns citing the KB doc', /research\/lib-drizzle\.md/.test(r.stderr), r.stderr.trim());
  ok('KB hit: still ledgers the call', r.rows.length === 1, `rows=${r.rows.length}`);
}

// 5. A bare `name.md` index row matches too (both index cell shapes).
{
  const ledger = freshLedger();
  const r = fire(JSON.stringify({
    tool_name: 'mcp__plugin_context7_context7__query-docs',
    tool_input: { libraryId: '/tanstack/query', query: 'invalidation' },
  }), { ledger });
  ok('KB hit: bare name.md row is indexed too', /research\/lib-tanstack-query\.md/.test(r.stderr), r.stderr.trim());
}

// 6. An unindexed library warns about nothing — and the placeholder row never matches.
{
  const ledger = freshLedger();
  const r = fire(JSON.stringify({
    tool_name: 'mcp__plugin_context7_context7__resolve-library-id',
    tool_input: { libraryName: 'Bevy', query: 'seed the ecs findings' },
  }), { ledger });
  ok('no KB doc: silent', r.stderr.trim() === '', r.stderr.trim());
  ok('no KB doc: still ledgered', r.rows.length === 1, `rows=${r.rows.length}`);
}

// 7. Missing KB index: still ledgers, still silent, still exit 0.
{
  const ledger = freshLedger();
  const bare = mkdtempSync(join(tmpdir(), 'kit-c7-bare-'));
  fixtures.push(bare);
  const r = fire(JSON.stringify({
    tool_name: 'mcp__plugin_context7_context7__resolve-library-id',
    tool_input: { libraryName: 'Drizzle ORM', query: 'migrations' },
  }), { ledger, pluginRoot: bare });
  ok('no KB index: exits 0 and ledgers anyway', r.code === 0 && r.rows.length === 1, `code=${r.code} rows=${r.rows.length}`);
}

// 8. Wiring parity — both install paths register the hook on the context7 matcher (KIT-T069).
{
  const registers = (file) => {
    const wiring = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
    const entry = wiring.hooks.PostToolUse.find((e) => e.hooks.some((h) => h.command.includes('context7-ledger')));
    return !!entry && new RegExp(entry.matcher).test('mcp__plugin_context7_context7__query-docs');
  };
  ok('wiring: the plugin registers context7-ledger on a matcher that hits context7 tools', registers('hooks/hooks.json'));
  ok('wiring: the bootstrap settings register it too (KIT-T069 parity)', registers('user-config/settings.recommended.json'));
}

for (const f of fixtures) { try { rmSync(f, { recursive: true, force: true }); } catch { /* best effort */ } }
console.log(`\ncontext7-ledger: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
