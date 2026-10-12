#!/usr/bin/env node
// Tests for concern-check (KIT-T423): the framework's CHOICES.toml primitives are found in game
// files through the real q code index, and never in the framework tree, *_tests.rs or tests/.
// Run: node scripts/concern-check.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const cache = mkdtempSync(join(tmpdir(), 'cc-cache-'));
process.env.CLAUDE_KIT_CODE_INDEX_DIR = cache;
const root = mkdtempSync(join(tmpdir(), 'cc-repo-'));
const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

const CHOICES = `# ledger
[[choice]]
concern = "screen input and pointer mapping"
crate = "rg-screens"
tier = "own"
primitives = [
  "RelativeCursorPosition",
  "cursor_position(",
]
why = "one home"

[[choice]]
concern = "engine door"
crate = "rg-engine"
why = "no primitives declared, so never checked"
`;
const USES = 'fn follow_mouse(q: Query<&RelativeCursorPosition>) {}\n';
put('.gitmodules', '[submodule "rapid-game"]\n\tpath = rapid-game\n');
put('rapid-game/.git', 'gitdir: ../.git/modules/rapid-game\n');
put('rapid-game/docs/CHOICES.toml', CHOICES);
put('rapid-game/rust/ui/rg-screens/src/read_input.rs', USES);
put('crates/bay/src/dock/view.rs', `use bevy::prelude::*;\n${USES}`);
put('crates/bay/src/context/edit.rs', 'fn pick(w: &Window) { let p = w.cursor_position(); }\n');
put('crates/bay/src/dock/view_tests.rs', USES);
put('crates/bay/tests/pointer.rs', USES);
put('crates/bay/src/clean.rs', 'fn nothing() {}\n');

const noTickets = async () => [];
const deps = { tickets: noTickets };

const { concernBlock, concernFindings, findingLine, isGameFile, readOwnership, BLOCK_MAX } = await import('./concern-check.mjs');

await test('readOwnership: only rows declaring primitives, multi-line arrays parsed', () => {
  const rows = readOwnership(join(root, 'rapid-game'));
  assert.deepEqual(rows, [{ concern: 'screen input and pointer mapping', crate: 'rg-screens', primitives: ['RelativeCursorPosition', 'cursor_position('] }]);
});

await test('readOwnership: a missing map or field is no rows (fail-open)', () => {
  assert.deepEqual(readOwnership(join(root, 'nowhere')), []);
  const bare = mkdtempSync(join(tmpdir(), 'cc-bare-'));
  mkdirSync(join(bare, 'docs'));
  writeFileSync(join(bare, 'docs', 'CHOICES.toml'), '[[choice]]\nconcern = "x"\ncrate = "rg-x"\n');
  assert.deepEqual(readOwnership(bare), []);
  rmSync(bare, { recursive: true, force: true });
});

await test('isGameFile: framework tree, *_tests.rs and tests/ are not game files', () => {
  assert.equal(isGameFile('crates/bay/src/dock/view.rs', ['rapid-game']), true);
  assert.equal(isGameFile('rapid-game/rust/ui/rg-screens/src/read_input.rs', ['rapid-game']), false);
  assert.equal(isGameFile('crates/bay/src/dock/view_tests.rs', ['rapid-game']), false);
  assert.equal(isGameFile('crates/bay/tests/pointer.rs', ['rapid-game']), false);
  assert.equal(isGameFile('rapid-game-fork/src/a.rs', ['rapid-game']), true);
});

await test('invariant: a game file using a declared primitive is flagged; framework and test copies are not', async () => {
  const found = await concernFindings(root, deps);
  assert.equal(found.length, 1);
  const [f] = found;
  assert.equal(f.concern, 'screen input and pointer mapping');
  assert.equal(f.crate, 'rg-screens');
  assert.deepEqual(f.files, [{ path: 'crates/bay/src/context/edit.rs', lines: [1] }, { path: 'crates/bay/src/dock/view.rs', lines: [2] }]);
  const paths = f.files.map((x) => x.path);
  for (const excluded of ['rapid-game/rust/ui/rg-screens/src/read_input.rs', 'crates/bay/src/dock/view_tests.rs', 'crates/bay/tests/pointer.rs']) {
    assert.ok(!paths.includes(excluded), `${excluded} must not be flagged`);
  }
});

await test('report line names concern, owner, count, file:line and open tickets', async () => {
  const [f] = await concernFindings(root, { tickets: async () => ['ST-T283', 'ST-T900'] });
  assert.equal(findingLine(f), 'concern "screen input and pointer mapping" owned by rg-screens; game does it locally in 2 files: crates/bay/src/context/edit.rs:1 crates/bay/src/dock/view.rs:2 open tickets: ST-T283 ST-T900');
});

await test('orient block: header plus findings, capped at BLOCK_MAX lines', async () => {
  const one = await concernBlock(root, deps);
  assert.equal(one.length, 2);
  assert.match(one[0], /FRAMEWORK OWNS THIS/);
  const many = Array.from({ length: 9 }, (_, i) => ({ name: `fw${i}`, dir: join(root, 'rapid-game') }));
  const capped = await concernBlock(root, { ...deps, frameworks: () => many });
  assert.equal(capped.length, BLOCK_MAX);
  assert.match(capped[BLOCK_MAX - 1], /\+6 more concern/);
});

await test('no framework adopted: no findings, no block', async () => {
  const plain = mkdtempSync(join(tmpdir(), 'cc-plain-'));
  writeFileSync(join(plain, 'a.rs'), USES);
  assert.deepEqual(await concernBlock(plain, deps), []);
  rmSync(plain, { recursive: true, force: true });
});

rmSync(root, { recursive: true, force: true });
rmSync(cache, { recursive: true, force: true });
console.log(`\nconcern-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
