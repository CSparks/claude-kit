#!/usr/bin/env node
// Tests for the kit-bug pipeline (KIT-T286): deduped tickets in the kit store from q misses,
// grep-after-empty-q, hook crashes and `cap bug`; orient lists the open ones.
// Run: node scripts/kit-bug.test.mjs

import { copyFileSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { adopted, cleanup, hook, script, tmpDir } from '../hooks/test-harness.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const store = tmpDir('kit-store-');
mkdirSync(join(store, '.ai', 'tickets'), { recursive: true });
copyFileSync(join(KIT, '.ai', 'config.yml'), join(store, '.ai', 'config.yml'));
const env = { CLAUDE_KIT_BUG_STORE: store, CLAUDE_KIT_TURN_STATE: tmpDir('kit-turn-'), CLAUDE_KIT_SEARCH_LOG_DIR: tmpDir('kit-slog-') };
process.env.CLAUDE_KIT_BUG_STORE = store;
const { fileKitBug, openKitBugs, openKitBugPage, kitStoreRoot, kitBugBlock, STANDING_KIT_AGENT } = await import('./kit-bug.mjs');
const { reportHookCrash } = await import('../hooks/compat-core.mjs');

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
const tickets = () => readdirSync(join(store, '.ai', 'tickets')).filter((n) => n.endsWith('.md'));
const read = (n) => readFileSync(join(store, '.ai', 'tickets', n), 'utf8');

await test('fileKitBug creates a labelled ticket carrying its shape', () => {
  const r = fileKitBug({ shape: 'q-gap:verb:nope', title: 'q gap: unknown query nope', detail: 'q nope x', project: 'game' });
  assert.equal(r.created, true);
  const text = read(tickets()[0]);
  assert.match(text, /^labels: \[kit-bug\]$/m);
  assert.match(text, /kit-bug-shape: q-gap:verb:nope/);
  assert.match(text, /first seen in game/);
});

await test('a long capture lands in the ticket Description whole', () => {
  const body = Array.from({ length: 60 }, (_, i) => `clause-${i} of the capture`).join(', ') + '.\nsecond line stays';
  const r = fileKitBug({ shape: 'long:capture', title: 'long capture', detail: body });
  assert.equal(r.created, true);
  const text = read(tickets().find((n) => /long:capture/.test(read(n))));
  assert.ok(body.length > 1000 && text.includes(body), 'full text, newlines kept');
});

await test('the same shape recurs into the open ticket instead of a new one', () => {
  const before = tickets().length;
  const r = fileKitBug({ shape: 'q-gap:verb:nope', title: 'q gap: unknown query nope', detail: 'q nope y', project: 'other' });
  assert.equal(r.created, false);
  assert.equal(tickets().length, before);
  assert.match(read(tickets()[0]), /seen again in other: q nope y/);
});

await test('a different shape is a new ticket; a closed one is filed again', () => {
  assert.equal(fileKitBug({ shape: 'other:shape', title: 'another gap', detail: 'd' }).created, true);
  const first = tickets()[0];
  writeFileSync(join(store, '.ai', 'tickets', first), read(first).replace(/^status: todo$/m, 'status: review'));
  assert.equal(fileKitBug({ shape: 'q-gap:verb:nope', title: 'again', detail: 'd' }).created, true);
});

await test('openKitBugs lists open kit-bug tickets, skips ones an agent is doing', () => {
  const open = openKitBugs();
  assert.ok(open.length >= 2 && open.every((b) => b.id && b.title));
  const doing = tickets().find((n) => /other:shape/.test(read(n)));
  writeFileSync(join(store, '.ai', 'tickets', doing), read(doing).replace(/^status: todo$/m, 'status: doing'));
  assert.ok(!openKitBugs().some((b) => b.title === 'another gap'));
});

await test('a doing ticket untouched past the claim window belongs to a dead agent and lists again (KIT-T768)', () => {
  const doing = tickets().find((n) => /other:shape/.test(read(n)));
  const path = join(store, '.ai', 'tickets', doing);
  assert.ok(!openKitBugs().some((b) => b.title === 'another gap'), 'control: a fresh claim holds');
  const stale = new Date(Date.now() - 5 * 60 * 60 * 1000);
  utimesSync(path, stale, stale);
  assert.ok(openKitBugs().some((b) => b.title === 'another gap'));
  const now = new Date();
  utimesSync(path, now, now);
  assert.ok(!openKitBugs().some((b) => b.title === 'another gap'), 'touching the ticket renews the claim');
});

await test('without a kit store nothing is filed', () => {
  const saved = process.env.CLAUDE_KIT_BUG_STORE;
  process.env.CLAUDE_KIT_BUG_STORE = join(store, 'missing');
  assert.equal(kitStoreRoot(), null);
  assert.equal(fileKitBug({ shape: 'x', title: 'x', detail: 'x' }), null);
  process.env.CLAUDE_KIT_BUG_STORE = saved;
});

await test('q on an unknown query files a gap and says so', () => {
  const r = script('q.mjs', ['frobnicate', 'KIT-T1'], store, env);
  assert.equal(r.code, 1);
  assert.match(r.err, /unknown query 'frobnicate'.*Filed as KIT-T\d+ \(kit-bug\)/);
  assert.ok(tickets().some((n) => /verb:frobnicate/.test(read(n))));
  const n = tickets().length;
  script('q.mjs', ['frobnicate', 'again'], store, env);
  assert.equal(tickets().length, n, 'a repeat dedups');
});

await test('q on an unsupported flag files a gap and exits 1', () => {
  const r = script('q.mjs', ['open', '--bogus-flag'], store, env);
  assert.equal(r.code, 1);
  assert.match(r.err, /does not take --bogus-flag.*Filed as KIT-T\d+/);
  assert.ok(tickets().some((n) => /flag:open:--bogus-flag/.test(read(n))));
});

await test('q <verb> --help prints that verb\'s usage, exits 0 and files nothing (KIT-T338)', () => {
  const n = tickets().length;
  for (const [verb, first] of [['code', /^ {2}code <text> \[filters\]/], ['sym', /^ {2}sym \[<name>\]/], ['file', /^ {2}file <substring\|glob>/], ['open', /^ {2}open \[scope\]/]]) {
    const r = script('q.mjs', [verb, '--help'], store, { ...env, CLAUDE_KIT_Q_SERVER: 'off' });
    assert.equal(r.code, 0, verb);
    assert.match(r.out, first, verb);
    assert.doesNotMatch(r.out, /^usage:/m, `${verb} prints its own entry, not the whole surface`);
  }
  assert.equal(tickets().length, n);
});

await test('q <unknown verb> --help prints the whole surface', () => {
  const r = script('q.mjs', ['frobnicate', '--help'], store, { ...env, CLAUDE_KIT_Q_SERVER: 'off' });
  assert.equal(r.code, 0);
  assert.match(r.out, /^usage: q\.mjs/);
});

await test('q with supported flags files nothing', () => {
  const n = tickets().length;
  script('q.mjs', ['fts', '--scope', 'all', 'zzzz'], store, env);
  assert.equal(tickets().length, n);
});

const repo = tmpDir('game-');
const post = (tool, input, response) => hook('search-telemetry.mjs', { tool_name: tool, tool_input: input, tool_response: response, session_id: 's' }, repo, env);
await test('a grep right after an empty q on overlapping terms files a gap with both commands', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const n = tickets().length;
  post('Bash', { command: 'node q.mjs fts sleepwake rings' }, { stdout: '(no results)\n' });
  post('Bash', { command: 'rg -t rust sleepwake crates' }, { stdout: 'x' });
  assert.equal(tickets().length, n + 1);
  assert.ok(tickets().some((n2) => /grep-after-empty-q:fts/.test(read(n2)) && /sleepwake/.test(read(n2))));
});
await test('a grep on unrelated terms, or after a q that answered, files nothing', () => {
  const n = tickets().length;
  post('Bash', { command: 'node q.mjs fts alphabeta' }, { stdout: '(no results)\n' });
  post('Bash', { command: 'rg -t rust gammadelta crates' }, { stdout: 'x' });
  post('Bash', { command: 'node q.mjs fts epsilonzeta' }, { stdout: 'ST-T1  something' });
  post('Bash', { command: 'rg -t rust epsilonzeta crates' }, { stdout: 'x' });
  assert.equal(tickets().length, n);
});

await test('a crashing hook files a hook-error ticket; a clean block (exit 2) does not', async () => {
  const n = tickets().length;
  await reportHookCrash('pre-write.mjs', [{ status: 2, stderr: 'BLOCKED' }]);
  assert.equal(tickets().length, n);
  await reportHookCrash('pre-write.mjs', [{ status: 1, stderr: 'TypeError: boom' }]);
  assert.equal(tickets().length, n + 1);
  assert.ok(tickets().some((t) => /hook-error:pre-write.mjs/.test(read(t))));
  await reportHookCrash('lint.mjs', [{ status: 0, stderr: '[lint] internal error — failing open: x' }]);
  assert.equal(tickets().length, n + 2);
});

await test('cap bug into the kit store becomes a kit-bug ticket, not an inbox note', () => {
  const n = tickets().length;
  const r = script('cap.mjs', ['bug', 'hook misfires on every rebase'], store, { ...env, CLAUDE_KIT_REGISTRY: join(store, 'no-registry.json') });
  assert.match(r.out, /filed KIT-T\d+ \(kit-bug\)/);
  assert.equal(tickets().length, n + 1);
  assert.equal(readdirSync(join(store, '.ai')).includes('inbox'), false);
});

await test('cap feature into the kit store becomes a kit-feature ticket (from any session)', () => {
  const n = tickets().length;
  const r = script('cap.mjs', ['feature', 'q needs a --since flag on recent'], store, { ...env, CLAUDE_KIT_REGISTRY: join(store, 'no-registry.json') });
  assert.match(r.out, /filed KIT-T\d+ \(kit-feature\)/);
  assert.equal(tickets().length, n + 1);
  const t = tickets().find((f) => /--since flag/.test(read(f)));
  assert.match(read(t), /^labels: \[kit-feature\]$/m);
  assert.match(read(t), /^type: feature$/m);
  assert.ok(openKitBugs(50).some((b) => /--since flag/.test(b.title)), 'features are listed with the bugs');
});

await test('orient lists open kit-bug tickets under DISPATCH NOW', () => {
  const o = adopted(false);
  const r = hook('orient.mjs', { hook_event_name: 'SessionStart' }, o, env);
  assert.match(r.out, /--- DISPATCH NOW: open kit-bug \/ kit-feature tickets/);
  assert.match(r.out, /KIT-T\d+(?: \[\w+\])? — /);
  assert.match(r.out, /Policy \(KIT-D094\): keep ONE standing kit agent/, 'the standing-agent rule is replayed with them');
});

await test('negative: no open kit tickets, no DISPATCH NOW block and no policy line', () => {
  assert.deepEqual(kitBugBlock([]), []);
  assert.equal(kitBugBlock([{ id: 'KIT-T1', title: 'x' }])[1], `  ${STANDING_KIT_AGENT}`);
});

await test('kit bugs list by priority, then asked count, then newest; the block says N open, showing M', () => {
  const dir = join(store, '.ai', 'tickets');
  const stamped = (id, priority, asked, created, title) => writeFileSync(join(dir, `${id}-order.md`), ['---', `id: ${id}`, `title: ${title}`, 'type: bug', 'status: todo', `priority: ${priority}`, 'labels: [kit-bug]', `asked: ${asked}`, `created: ${created}`, '---', ''].join('\n'));
  stamped('KIT-T901', 'low', 1, '2026-01-01T00:00:00Z', 'old low');
  stamped('KIT-T902', 'low', 1, '2026-02-01T00:00:00Z', 'newer low');
  stamped('KIT-T903', 'high', 1, '2026-01-15T00:00:00Z', 'older high');
  stamped('KIT-T904', 'high', 3, '2026-01-10T00:00:00Z', 'asked high');
  stamped('KIT-T905', 'high', 1, '2026-10-29T00:00:00Z', 'newest high');
  const page = openKitBugPage(50);
  const order = page.bugs.filter((b) => /^KIT-T90/.test(b.id)).map((b) => b.id);
  assert.deepEqual(order, ['KIT-T904', 'KIT-T905', 'KIT-T903', 'KIT-T902', 'KIT-T901']);
  const block = kitBugBlock(openKitBugPage(2));
  assert.match(block[0], new RegExp(`${page.total} open, showing 2`));
  assert.match(block[0], /dispatch required/);
  assert.ok(!/agent dispatched/.test(block.join('\n')));
});

cleanup();
