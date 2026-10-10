#!/usr/bin/env node
// Tests for repeat-ask escalation (KIT-T405): bumpAsked steps priority and counts asks, an exact
// kit-bug shape match from a human capture escalates, a hook-style repeat and a loose hit never do,
// `t asked` confirms a match by hand, and orient lists tickets asked twice or more.
// Run: node scripts/asked-again.test.mjs

import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cleanup, tmpDir } from '../hooks/test-harness.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const store = tmpDir('asked-store-');
mkdirSync(join(store, '.ai', 'tickets'), { recursive: true });
copyFileSync(join(KIT, '.ai', 'config.yml'), join(store, '.ai', 'config.yml'));
process.env.CLAUDE_KIT_BUG_STORE = store;
const { fileKitBug } = await import('./kit-bug.mjs');
const { bumpAsked, askedAgainOpen } = await import('./asked-again.mjs');

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
spawnSync('git', ['init', '-q'], { cwd: store });
const dir = join(store, '.ai', 'tickets');
const file = (id) => join(dir, readdirSync(dir).find((n) => n.startsWith(`${id}-`)));
const read = (id) => readFileSync(file(id), 'utf8');
const mk = (shape, repeatAsk) => fileKitBug({ shape, title: `ticket ${shape}`, detail: `detail ${shape}`, repeatAsk });

await test('bumpAsked steps priority one level, counts the ask, logs History', () => {
  const { id } = mk('cap:bug:alpha');
  const prio = (t) => /^priority:\s*(\S+)/m.exec(t)[1];
  const start = prio(read(id));
  const r = bumpAsked(file(id), 'inbox/2026-10-09-capture.md');
  assert.equal(r.asked, 2);
  assert.notEqual(prio(read(id)), start === 'critical' ? '' : start);
  assert.match(read(id), /^asked: 2$/m);
  assert.match(read(id), /\(asked again\) \d{4}-\d\d-\d\d — inbox\/2026-10-09-capture\.md/);
});

await test('priority never passes critical; the counter keeps climbing', () => {
  const { id } = mk('cap:bug:beta');
  for (let i = 0; i < 6; i++) bumpAsked(file(id), `c${i}`);
  assert.match(read(id), /^priority: critical$/m);
  assert.match(read(id), /^asked: 7$/m);
});

await test('an exact shape match from a human capture escalates', () => {
  const { id } = mk('cap:bug:gamma', true);
  assert.doesNotMatch(read(id), /^asked:/m);
  const again = mk('cap:bug:gamma', true);
  assert.equal(again.created, false);
  assert.match(read(id), /^asked: 2$/m);
});

await test('a machine repeat (no repeatAsk) never escalates', () => {
  const { id } = mk('hook-error:x.mjs');
  mk('hook-error:x.mjs');
  assert.doesNotMatch(read(id), /^asked:/m);
});

await test('t asked confirms a match by hand and prints the bump', () => {
  const { id } = mk('cap:bug:delta');
  const r = spawnSync(process.execPath, [join(KIT, 'scripts', 't.mjs'), 'asked', id, '--note', 'inbox/x.md', '--root', store], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`asked: ${id} asked 2x`));
  assert.match(read(id), /^asked: 2$/m);
});

await test('askedAgainOpen lists asked>=2 open tickets, not closed or once-asked ones', () => {
  const ids = askedAgainOpen(store).map((r) => r.id);
  const once = mk('cap:bug:once').id;
  assert.ok(ids.length >= 3);
  assert.ok(!askedAgainOpen(store).some((r) => r.id === once));
  const top = askedAgainOpen(store)[0];
  assert.ok(top.asked >= 2);
});

await test('orient prints asked Nx under DISPATCH NOW', () => {
  const r = spawnSync(process.execPath, [join(KIT, 'hooks', 'orient.mjs')], {
    cwd: store, encoding: 'utf8', input: '{}',
    env: { ...process.env, CLAUDE_KIT_TURN_STATE: tmpDir('asked-turn-') },
  });
  const out = `${r.stdout}${r.stderr}`;
  assert.match(out, /tickets asked for again/);
  assert.match(out, /asked \d+x/);
});

cleanup();
console.log(fail === 0 ? `\nasked-again: all pass (${pass})` : `\nasked-again: ${fail} FAILED, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
