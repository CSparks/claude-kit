// Tests for the SessionStart latency work (KIT-T401): the stat-keyed cache, the cached closure
// scans, the cached item scan and the orientation budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cache = mkdtempSync(join(tmpdir(), 'statcache-'));
process.env.CLAUDE_KIT_CACHE_DIR = cache;

const { statCached, statMarkdownFiles } = await import('./lib/stat-cache.mjs');
const { scanReviewQueue, scanStaleDoingTickets } = await import('./lib/closure-scans.mjs');
const { fitOrientation } = await import('./lib/orient-budget.mjs');
const { collectItems } = await import('../scripts/db-parse.mjs');
const { collectItemsCached } = await import('../scripts/items-cache.mjs');

const ticket = (id, status, extra = '') => `---\nid: ${id}\ntitle: t ${id}\nstatus: ${status}\n${extra}---\n\nbody ${id}\n`;

function store(tickets) {
  const root = mkdtempSync(join(tmpdir(), 'statcache-repo-'));
  const dir = join(root, '.ai', 'tickets');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: ZZ\n  pad: 3\nuat: required\n');
  for (const [name, text] of Object.entries(tickets)) writeFileSync(join(dir, name), text);
  return { root, dir };
}

test('statCached recomputes only the files whose stat changed', () => {
  const { dir } = store({ 'a.md': 'one', 'b.md': 'two' });
  const calls = [];
  const compute = (p) => { calls.push(p); return p.length; };
  const run = () => statCached('t1', statMarkdownFiles(dir), compute);
  run();
  assert.equal(calls.length, 2);
  run();
  assert.equal(calls.length, 2, 'unchanged files are not recomputed');
  writeFileSync(join(dir, 'a.md'), 'one!');
  run();
  assert.equal(calls.length, 3, 'only the edited file is recomputed');
  rmSync(join(dir, 'b.md'));
  assert.equal(run().length, 1, 'a vanished file is dropped');
});

test('a corrupt cache file degrades to computing every file', () => {
  const { dir } = store({ 'a.md': 'one' });
  writeFileSync(join(cache, 't2.json'), '{not json');
  assert.deepEqual(statCached('t2', statMarkdownFiles(dir), () => 7), [7]);
});

test('closure scans follow a ticket edited after the cache was written', () => {
  const old = new Date(Date.now() - 5 * 86400000);
  const { root, dir } = store({ 'ZZ-T001-a.md': ticket('ZZ-T001', 'review'), 'ZZ-T002-b.md': ticket('ZZ-T002', 'doing', `updated: ${old.toISOString()}\n`) });
  assert.equal(scanReviewQueue(root).count, 1);
  assert.deepEqual(scanStaleDoingTickets(root, 7200000).ids, ['ZZ-T002']);
  writeFileSync(join(dir, 'ZZ-T001-a.md'), ticket('ZZ-T001', 'done') + 'x'.repeat(10));
  assert.equal(scanReviewQueue(root).count, 0, 'review ticket moved on');
  writeFileSync(join(dir, 'ZZ-T002-b.md'), ticket('ZZ-T002', 'doing', `updated: ${new Date().toISOString()}\n`));
  assert.equal(scanStaleDoingTickets(root, 7200000).count, 0, 'a fresh updated stamp clears the zombie');
});

test('collectItemsCached returns the rows collectItems does, cold and warm', () => {
  const { root } = store({ 'ZZ-T001-a.md': ticket('ZZ-T001', 'todo'), 'ZZ-T002-b.md': ticket('ZZ-T002', 'doing', 'links: [ZZ-T001]\n') });
  mkdirSync(join(root, '.ai', 'inbox'));
  writeFileSync(join(root, '.ai', 'inbox', '2026-01-01-cap.md'), '(bug) idless capture\n');
  const plain = JSON.parse(JSON.stringify(collectItems(root)));
  assert.deepEqual(collectItemsCached(root), plain, 'cold');
  assert.deepEqual(collectItemsCached(root), plain, 'warm');
  writeFileSync(join(root, '.ai', 'tickets', 'ZZ-T001-a.md'), ticket('ZZ-T001', 'review'));
  assert.deepEqual(collectItemsCached(root), JSON.parse(JSON.stringify(collectItems(root))), 'after an edit');
});

const block = (header, n) => [header, ...Array.from({ length: n }, (_, i) => `  line ${i} ${'x'.repeat(60)}`)];

test('fitOrientation leaves a text inside the budget untouched', () => {
  const text = block('--- Decisions (recent) ---', 3).join('\n');
  assert.deepEqual(fitOrientation(text, { budget: 5000 }), { text, demoted: [] });
});

test('fitOrientation shortens low-priority blocks first and never the protected ones', () => {
  const text = [
    ...block('--- RETRIEVAL FIRST ---', 6),
    ...block('--- Decisions (recent) ---', 30),
    ...block('--- Open work ---', 8),
    ...block('--- IDENTITY & PROCESS (main thread) ---', 6),
  ].join('\n');
  const { text: fit, demoted } = fitOrientation(text, { budget: 2600, pointer: ' — full: /tmp/x' });
  assert.ok(fit.length <= 2600, `fits (${fit.length})`);
  assert.deepEqual(demoted, ['--- Decisions (recent) ---']);
  assert.match(fit, /… \(\+\d+ lines\) — full: \/tmp\/x/);
  assert.ok(fit.includes('line 5 ') && fit.split('--- RETRIEVAL FIRST ---')[1].includes('line 5'), 'protected block intact');
  assert.equal(fit.split('\n').filter((l) => l.startsWith('--- ')).length, 4, 'every header survives');
});

test('fitOrientation cuts a block to its header when its kept lines still overflow', () => {
  const text = [...block('--- RETRIEVAL FIRST ---', 4), ...block('--- Open work ---', 40)].join('\n');
  const { text: fit } = fitOrientation(text, { budget: 500 });
  const open = fit.split('--- Open work ---')[1];
  assert.match(open, /^\n  … \(\+40 lines\)/);
});


test('orient stays inside the budget on a store with a large review queue and long commit subjects', async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const pluginRoot = mkdtempSync(join(tmpdir(), 'kit-budget-plugin-'));
  const reg = join(pluginRoot, 'projects.json');
  const d = mkdtempSync(join(tmpdir(), 'kit-budget-'));
  const git = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), 'ids:\n  key: "BUD"\n  pad: 3\nuat: required\n');
  for (let i = 1; i <= 40; i++) {
    const id = `BUD-T${String(i).padStart(3, '0')}`;
    writeFileSync(join(d, '.ai', 'tickets', `${id}-x.md`), `---\nid: ${id}\ntitle: ${'long title '.repeat(40)}\ntype: feature\nstatus: review\npriority: high\n---\n\n## Description\nx\n`);
  }
  writeFileSync(join(d, '.ai', 'SESSION.md'), `${'a very long anchor line '.repeat(60)}\n`.repeat(8));
  for (let i = 0; i < 8; i++) { writeFileSync(join(d, `f${i}.txt`), 'x'); git('add', '.'); git('commit', '-q', '-m', `commit ${'subject words '.repeat(80)}`, '--no-verify'); }
  writeFileSync(reg, JSON.stringify({ projects: { bud: d } }));
  const r = spawnSync(process.execPath, [join(import.meta.dirname, 'orient.mjs')], {
    input: JSON.stringify({ hook_event_name: 'SessionStart' }), cwd: d, encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_KIT_REGISTRY: reg, CLAUDE_KIT_CACHE_DIR: cache },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.length <= 10000, `orientation is ${r.stdout.length} chars`);
  assert.match(r.stdout, /\+35 more in-flight — q open/);
  assert.ok(r.stdout.split('\n').every((l) => l.length <= 900), 'no single line runs away');
  rmSync(pluginRoot, { recursive: true, force: true });
  rmSync(d, { recursive: true, force: true });
});
test.after(() => rmSync(cache, { recursive: true, force: true }));
