#!/usr/bin/env node
// Tests for the landed-commit stamp (KIT-T444): hooks/commit-stamp.mjs after `git commit`, plus the
// readers built on its History lines (q show, orient's built-but-unticked list) and the
// `t status todo` guard. Temp repos and a temp registry only; the real stores are never touched.
// Run: node hooks/commit-stamp.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { setStatus } from '../scripts/t.mjs';
import { showRows } from '../scripts/q-show.mjs';
import { builtButUnticked, implementedIds } from '../scripts/landed.mjs';

const HOOK = fileURLToPath(new URL('./commit-stamp.mjs', import.meta.url));
let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const base = mkdtempSync(join(tmpdir(), 'cstamp-'));
const put = (abs, text) => { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, text); };
const ticket = (id, status = 'todo') => `---\nid: ${id}\ntitle: ticket ${id}\ntype: feature\nstatus: ${status}\n---\n\n## Description\nx\n\n## History\n- [2026-10-01 10:00] (created) feature — x\n`;

function repoWith(name, key, ids) {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  put(join(dir, '.ai', 'config.yml'), `ids:\n  key: "${key}"\nstatuses:\n  flow: [todo, doing, review, done]\n`);
  for (const id of ids) put(join(dir, '.ai', 'tickets', `${id}-t.md`), ticket(id));
  return dir;
}
const here = repoWith('here', 'ZZA', ['ZZA-T001', 'ZZA-T002']);
const other = repoWith('other', 'ZZB', ['ZZB-T001']);
const registry = join(base, 'registry.json');
writeFileSync(registry, JSON.stringify({ projects: { here, other } }));
process.env.CLAUDE_KIT_REGISTRY = registry;

let n = 0;
function commit(subject) {
  put(join(here, `f${++n}.txt`), String(n));
  execFileSync('git', ['add', '-A'], { cwd: here });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', subject], { cwd: here });
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: here, encoding: 'utf8', env: process.env,
    input: JSON.stringify({ tool_input: { command: `git commit -m "${subject}"` } }),
  });
  return { code: r.status, err: r.stderr };
}
const read = (dir, id) => readFileSync(join(dir, '.ai', 'tickets', `${id}-t.md`), 'utf8');
const landed = (text) => text.split('\n').filter((l) => /\(landed\)/.test(l));

await test('implementedIds: lists after "implements", tickets only, deduped', () => {
  assert.deepEqual(implementedIds('x (implements ST-T894)'), ['ST-T894']);
  assert.deepEqual(implementedIds('x implements RG-T1, KIT-T2 and ST-T3'), ['RG-T1', 'KIT-T2', 'ST-T3']);
  assert.deepEqual(implementedIds('x implements KIT-D045'), []);
  assert.deepEqual(implementedIds('mentions KIT-T7 in passing'), []);
});

await test('a commit citing a ticket gets one (landed) History line: sha and subject', () => {
  const r = commit('first slice (implements ZZA-T001)');
  assert.equal(r.code, 0);
  const lines = landed(read(here, 'ZZA-T001'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^- \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] \(landed\) [0-9a-f]{7,} first slice \(implements ZZA-T001\)$/);
  assert.match(read(here, 'ZZA-T001'), /\(created\) feature/, 'prior History lines are kept');
});

await test('the stamp is written once per sha: re-running the hook, then a second commit, adds only the new sha', () => {
  const again = spawnSync(process.execPath, [HOOK], { cwd: here, encoding: 'utf8', input: JSON.stringify({ tool_input: { command: 'git commit --amend --no-edit' } }) });
  assert.equal(again.status, 0);
  assert.equal(landed(read(here, 'ZZA-T001')).length, 1);
  commit('second slice (implements ZZA-T001)');
  assert.equal(landed(read(here, 'ZZA-T001')).length, 2);
});

await test('two ids in one subject are both stamped, across stores the registry resolves', () => {
  commit('both (implements ZZA-T002, ZZB-T001)');
  assert.equal(landed(read(here, 'ZZA-T002')).length, 1);
  assert.equal(landed(read(other, 'ZZB-T001')).length, 1);
});

await test('an unknown id warns on stderr, stamps nothing, and the hook still exits 0', () => {
  const r = commit('ghost (implements ZZA-T099)');
  assert.equal(r.code, 0);
  assert.match(r.err, /ZZA-T099: no ticket file found/);
});

await test('a commit that cites no ticket, or is not a commit command, changes nothing', () => {
  const before = read(here, 'ZZA-T002');
  commit('plain change');
  const other = spawnSync(process.execPath, [HOOK], { cwd: here, encoding: 'utf8', input: JSON.stringify({ tool_input: { command: 'git status' } }) });
  assert.equal(other.status, 0);
  assert.equal(read(here, 'ZZA-T002'), before);
});

await test('q show prints LANDED COMMITS: n (last <sha> <date>) from the History lines', () => {
  const rows = showRows('ZZA-T001', here);
  const line = rows.find((l) => l.startsWith('LANDED COMMITS'));
  assert.match(line, /^LANDED COMMITS: 2 \(last [0-9a-f]{7,} \d{4}-\d{2}-\d{2}\)$/);
  assert.equal(showRows('ZZA-T002', here).find((l) => l.startsWith('LANDED')), 'LANDED COMMITS: 1 (last ' + /[0-9a-f]{7,}/.exec(read(here, 'ZZA-T002'))[0] + ' ' + /\d{4}-\d{2}-\d{2}(?= \d{2}:\d{2}\] \(landed\))/.exec(read(here, 'ZZA-T002'))[0] + ')');
});

await test('q show prints no LANDED line for a ticket without landed commits', () => {
  assert.equal(showRows('ZZB-T002', other).some((l) => l.startsWith('LANDED')), false);
  put(join(here, '.ai', 'tickets', 'ZZA-T003-t.md'), ticket('ZZA-T003'));
  assert.equal(showRows('ZZA-T003', here).some((l) => l.startsWith('LANDED')), false);
});

await test('orient list: todo/doing tickets with landed commits are built-but-unticked, with the count', () => {
  const rows = builtButUnticked(here).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(rows.map((r) => [r.id, r.status, r.count]), [['ZZA-T001', 'todo', 2], ['ZZA-T002', 'todo', 1]]);
});

await test('t status todo on a ticket with landed commits is refused without --remaining', () => {
  setStatus(here, 'ZZA-T001', 'doing');
  assert.throws(() => setStatus(here, 'ZZA-T001', 'todo'), /2 landed commit\(s\).*--remaining/);
  assert.throws(() => setStatus(here, 'ZZA-T001', 'todo', { remaining: '  ' }), /--remaining/);
  assert.match(read(here, 'ZZA-T001'), /status: doing/);
});

await test('t status todo with --remaining flips and records the text as a comment', () => {
  setStatus(here, 'ZZA-T001', 'todo', { remaining: 'S3 and the UAT pass' });
  const text = read(here, 'ZZA-T001');
  assert.match(text, /status: todo/);
  assert.match(text, /\(comment\) remaining after 2 landed commit\(s\): S3 and the UAT pass/);
});

await test('other transitions, and todo on a ticket without landed commits, need no --remaining', () => {
  setStatus(here, 'ZZA-T001', 'review');
  setStatus(here, 'ZZA-T003', 'doing');
  setStatus(here, 'ZZA-T003', 'todo');
  assert.match(read(here, 'ZZA-T003'), /status: todo/);
});

rmSync(base, { recursive: true, force: true });
console.log(`\ncommit-stamp: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
