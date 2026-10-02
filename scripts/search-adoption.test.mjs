#!/usr/bin/env node
// Adoption of q as THE search tool is engineered, not hoped for (KIT-T101): orient prints the
// cheat-sheet, the base contract names q, every gate block prints the exact q equivalent, and
// agent definitions and dispatch commands inherit the instruction. Run: node scripts/search-adoption.test.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { adopted, cleanup, hook } from '../hooks/test-harness.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(KIT, rel), 'utf8');
let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

test('every tracked agent definition carries the q-first search section', () => {
  const tracked = execFileSync('git', ['ls-files', 'agents'], { cwd: KIT, encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.md') && !f.endsWith('README.md'));
  assert.ok(tracked.length >= 10);
  for (const f of tracked) {
    const text = read(f);
    assert.match(text, /## Search — q first/, f);
    assert.match(text, /q code <text>/, f);
    assert.match(text, /cap feature "q: <what is missing>" --project claude-kit/, f);
  }
});

test('dispatching commands tell every brief to search with q', () => {
  for (const f of ['commands/work.md', 'commands/drain.md']) assert.match(read(f), /Search with q\.mjs \(q code \/ sym \/ file \/ fts\), never grep/, f);
});

test('the base contract names q as THE search tool and the kit-feature escape', () => {
  const base = read('user-config/CLAUDE.global.md');
  assert.match(base, /## q is THE search tool — never grep or rg/);
  assert.match(base, /cap feature "q: …" --project claude-kit/);
});

test('orient prints the q search cheat-sheet', () => {
  const r = hook('orient.mjs', { hook_event_name: 'SessionStart' }, adopted(false));
  assert.match(r.out, /--- SEARCH WITH q, NOT grep\/rg/);
  assert.match(r.out, /q code <text> \[--lang rust\]/);
  assert.match(r.out, /q sym <name>/);
});

test('a store-grep block prints the exact q fts equivalent of the blocked command', () => {
  const r = hook('query-gate.mjs', { tool_input: { command: 'grep -rn physics .ai/decisions/' } }, adopted(false));
  assert.equal(r.code, 2);
  assert.match(r.out, /Exact equivalent:  node ".*q\.mjs" fts physics/);
});

test('a source-discovery block prints the exact q code equivalent', () => {
  const r = hook('query-gate.mjs', { tool_input: { command: 'rg "useState" src/' } }, adopted(false));
  assert.equal(r.code, 2);
  assert.match(r.out, /Exact equivalent:  node ".*q\.mjs" code useState/);
});

test('a redirected Rust grep prints a runnable q code command (not just a pointer)', () => {
  const r = hook('query-gate.mjs', { tool_input: { command: 'rg -t rust "fn spawn_camp"' } }, adopted(false));
  assert.equal(r.code, 2);
  assert.match(r.out, /q\.mjs" code 'fn spawn_camp' --lang rust/);
});

cleanup();
console.log(`\nsearch-adoption: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
