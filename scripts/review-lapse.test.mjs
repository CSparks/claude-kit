#!/usr/bin/env node
// Tests for the review-lapse sweep + reopen-on-collision (KIT-T658 / KIT-D107). Drives the real
// sweep, setStatus and cap CLI against throwaway stores; the cache and registry are private.
// Run: node scripts/review-lapse.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const tmp = mkdtempSync(join(tmpdir(), 'kit-lapse-'));
process.env.CLAUDE_KIT_DB = join(tmp, 'workflow.db');
process.env.CLAUDE_KIT_REGISTRY = join(tmp, 'no-registry.json');
process.env.KIT_USER = 'chris';

const { sweepLapse } = await import('./review-lapse.mjs');
const { setStatus } = await import('./t/status.mjs');
const { reopenOnCollision, findLapsedMatches } = await import('./lapsed-reopen.mjs');
const { lapseVerdict } = await import('./t/lapse-rule.mjs');
const CAP = fileURLToPath(new URL('./cap.mjs', import.meta.url));

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const MS_PER_DAY = 86_400_000;
const CONFIG = `statuses:
  flow: [todo, doing, review, done]
  human_only: [done]
uat:
  default: required
ids:
  key: "TST"
  prefix: "TST-T"
  pad: 3
classifications:
  bug: { routes_to: tickets, priority: high }
`;
const stampAgo = (days) => new Date(Date.now() - days * MS_PER_DAY).toISOString().replace('T', ' ').slice(0, 16);

let n = 0;
function makeStore() {
  const root = join(tmp, `p${++n}`);
  mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
  mkdirSync(join(root, '.ai', 'inbox'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
  return root;
}

function addTicket(root, id, { title = 'Some unrelated work', status = 'review', days = 20, history = [] } = {}) {
  const lines = [`- [${stampAgo(days + 1)}] (created) bug — ${title}`, `- [${stampAgo(days)}] (status) doing → review`, ...history];
  const text = `---\nid: ${id}\ntitle: ${title}\ntype: bug\nstatus: ${status}\npriority: high\nlabels: []\nlinks: []\ncreated: ${stampAgo(days + 1)}\nupdated: ${stampAgo(days)}\n---\n\n## Description\nbody\n\n## History\n${lines.join('\n')}\n`;
  writeFileSync(join(root, '.ai', 'tickets', `${id}.md`), text);
}

const inArchive = (root, id) => existsSync(join(root, '.ai', 'tickets', 'archive', `${id}.md`));
const read = (root, id) => readFileSync(join(root, '.ai', 'tickets', inArchive(root, id) ? 'archive' : '.', `${id}.md`), 'utf8');

console.log('\nthe 14-day boundary');
await test('13d in review stays, 15d lapses', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 13 });
  addTicket(root, 'TST-T002', { days: 15 });
  const r = await sweepLapse(root);
  assert.deepEqual(r.lapsed, ['TST-T002']);
  assert.match(read(root, 'TST-T001'), /status: review/);
  const t2 = read(root, 'TST-T002');
  assert.match(t2, /status: done/);
  assert.match(t2, /labels: \[lapsed\]/);
  assert.match(t2, /\(status\) review → done — lapsed: 14d in review, no maintainer feedback \(KIT-D107\)/);
  assert.ok(inArchive(root, 'TST-T002'));
  assert.match(readFileSync(join(root, '.ai', 'tickets', 'INDEX.md'), 'utf8'), /TST-T002/);
});

await test('--dry-run reports and writes nothing', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30 });
  const before = read(root, 'TST-T001');
  const r = await sweepLapse(root, { dryRun: true });
  assert.deepEqual(r.lapsed, ['TST-T001']);
  assert.equal(read(root, 'TST-T001'), before);
});

await test('entry time is the LAST ->review line; updated: is the fallback', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, history: [`- [${stampAgo(2)}] (status) todo → review`] });
  const text = `---\nid: TST-T002\ntitle: No history\ntype: bug\nstatus: review\nupdated: ${stampAgo(20)}\n---\n\n## History\n`;
  writeFileSync(join(root, '.ai', 'tickets', 'TST-T002.md'), text);
  const r = await sweepLapse(root);
  assert.deepEqual(r.lapsed, ['TST-T002']);
});

console.log('\nfeedback');
await test('a maintainer comment since entering review blocks the lapse', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, history: [`- [${stampAgo(5)}] (comment) @chris: still wanted`] });
  addTicket(root, 'TST-T002', { days: 30, history: [`- [${stampAgo(5)}] (comment) Chris: still wanted`] });
  const r = await sweepLapse(root);
  assert.deepEqual(r.lapsed, []);
  assert.deepEqual(r.blocked.sort(), ['TST-T001', 'TST-T002']);
});

await test('a maintainer comment from BEFORE the entry does not block', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, history: [] });
  const path = join(root, '.ai', 'tickets', 'TST-T001.md');
  const early = `- [${stampAgo(40)}] (comment) @chris: early note\n`;
  writeFileSync(path, readFileSync(path, 'utf8').replace('## History\n', `## History\n${early}`));
  assert.deepEqual((await sweepLapse(root)).lapsed, ['TST-T001']);
});

await test('agent-only comments (claude, ticked, tests, fixed, agents) do not block', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, history: [
    `- [${stampAgo(9)}] (comment) @claude: landed`,
    `- [${stampAgo(8)}] (comment) ticked: criterion 1`,
    `- [${stampAgo(7)}] (comment) tests: 12 passed`,
    `- [${stampAgo(6)}] (comment) fixed: abc1234`,
    `- [${stampAgo(5)}] (comment) @sonnet55: verified`,
  ] });
  assert.deepEqual((await sweepLapse(root)).lapsed, ['TST-T001']);
});

await test('a --human status stamp and a maintainer re-ask event block the lapse', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, history: [`- [${stampAgo(4)}] (status) review → todo (human)`] });
  addTicket(root, 'TST-T002', { days: 30, history: [`- [${stampAgo(4)}] (asked again) ${stampAgo(4).slice(0, 10)} — inbox/x.md`] });
  const r = await sweepLapse(root);
  assert.deepEqual(r.lapsed, []);
  assert.equal(r.blocked.length, 2);
});

console.log('\nidempotence and the human_only gate');
await test('a second run lapses nothing and changes no file', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30 });
  await sweepLapse(root);
  const once = read(root, 'TST-T001');
  const r = await sweepLapse(root);
  assert.deepEqual(r.lapsed, []);
  assert.equal(read(root, 'TST-T001'), once);
});

await test('human_only: [done] still refuses a plain done without --human', () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30 });
  assert.throws(() => setStatus(root, 'TST-T001', 'done', {}), /human_only|--human/);
  setStatus(root, 'TST-T001', 'done', { human: true });
  assert.match(read(root, 'TST-T001'), /\(status\) review → done \(human\)/);
});

await test('--lapsed is refused before 14d, from a non-review state, and toward any state but done', () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 13 });
  addTicket(root, 'TST-T002', { days: 30, status: 'doing' });
  addTicket(root, 'TST-T003', { days: 30 });
  assert.throws(() => setStatus(root, 'TST-T001', 'done', { lapsed: true }), /not lapsable/);
  assert.throws(() => setStatus(root, 'TST-T002', 'done', { lapsed: true }), /review → done/);
  assert.throws(() => setStatus(root, 'TST-T003', 'todo', { lapsed: true }), /review → done/);
  assert.equal(lapseVerdict(read(root, 'TST-T003')).eligible, true);
});

console.log('\nreopen on collision');
const GARAGE = 'Garage door sensor flickers on cold mornings';
await test('a capture colliding with a lapsed ticket reopens it; a normal done ticket stays closed', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, title: GARAGE });
  await sweepLapse(root);
  assert.ok(inArchive(root, 'TST-T001'));
  addTicket(root, 'TST-T002', { status: 'done', title: 'Basement humidity monitor drifts after reboot' });
  const lines = await reopenOnCollision(root, 'the garage door sensor flickers again on cold mornings', { author: 'chris' });
  assert.deepEqual(lines, ['reopened TST-T001 (KIT-D107)']);
  const t1 = read(root, 'TST-T001');
  assert.match(t1, /status: todo/);
  assert.doesNotMatch(t1, /labels: \[lapsed\]/);
  assert.match(t1, /\(comment\) @chris: the garage door sensor flickers again/);
  assert.ok(!inArchive(root, 'TST-T001'));
  const none = await reopenOnCollision(root, 'basement humidity monitor drifts after reboot', { author: 'chris' });
  assert.deepEqual(none, []);
  assert.match(read(root, 'TST-T002'), /status: done/);
});

await test('an unrelated capture reopens nothing', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, title: GARAGE });
  await sweepLapse(root);
  assert.deepEqual(await reopenOnCollision(root, 'add dark mode to the settings page'), []);
});

await test('a capture sharing only generic words and stopwords with a lapsed title reopens nothing (KIT-T231 vs KIT-T700)', async () => {
  const root = makeStore();
  const title = 'Magic-numbers pre-write gate blocks .patch files in the scratchpad';
  addTicket(root, 'TST-T002', { days: 30, title });
  await sweepLapse(root);
  const capture = 'Agents write source files through shell heredocs instead of Write/Edit. The code-quality pre-write gate (300/600-line limits) and the commit gate never see those files; allow scratchpad and temp writes';
  assert.deepEqual(await reopenOnCollision(root, capture), []);
  assert.equal(findLapsedMatches(root, title).length, 1, 'the ticket still matches its own title');
});

await test('cap prints `reopened <id> (KIT-D107)` for a lapsed match', async () => {
  const root = makeStore();
  addTicket(root, 'TST-T001', { days: 30, title: GARAGE });
  await sweepLapse(root);
  const out = execFileSync(process.execPath, [CAP, '--type', 'bug', 'garage door sensor flickers on cold mornings again'], { cwd: root, encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /reopened TST-T001 \(KIT-D107\)/);
  assert.match(read(root, 'TST-T001'), /status: todo/);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
