// coalesce-alias.test.mjs — a merged cargo test keeps the project alias it was written with (KIT-T649).
// rapid-game's `cargo t` is `nextest run --workspace --features rg-engine/dynamic_linking`; merging it into a bare
// `cargo nextest run` built the whole dependency stack a second time under another feature set (j-mvvcgf3d: 402 s).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coalesce } from './coalesce.mjs';
import { composeCommand } from './run.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const ALIAS = 'nextest run --workspace --features rg-engine/dynamic_linking';

function workspace() {
  const root = tempDir('coalesce-alias-');
  mkdirSync(join(root, 'rust', '.cargo'), { recursive: true });
  writeFileSync(join(root, 'rust', '.cargo', 'config.toml'), `[alias]\nt = "${ALIAS}"\n`);
  return root;
}

const cmds = (list, cwd) => coalesce(list, { cwd }).map((s) => s.cmd);

test('commands on a project alias merge under that alias, and the composed command keeps the alias feature set', () => {
  const root = workspace();
  try {
    const [merged] = cmds(['cd rust && cargo t -p rg-graphics --test player_app', 'cd rust && cargo t -p rg-graphics --test fullscreen_hotkey'], root);
    assert.equal(merged, 'cd rust && cargo t --no-fail-fast -p rg-graphics --test player_app --test fullscreen_hotkey');
    const composed = composeCommand(merged, { jobs: 3, cwd: root });
    assert.match(composed, /cargo nextest run --workspace --features rg-engine\/dynamic_linking /, composed);
    assert.ok(composed.includes('-E "package(rg-graphics)"'), composed);
  } finally { cleanup(root); }
});

test('an aliased verb merges across packages with the same selectors and names every package in the filterset', () => {
  const root = workspace();
  try {
    const [merged] = cmds(['cd rust && cargo t -p a --lib', 'cd rust && cargo t -p b --lib'], root);
    assert.equal(merged, 'cd rust && cargo t --no-fail-fast -p a -p b --lib');
    assert.ok(composeCommand(merged, { jobs: 3, cwd: root }).includes('-E "package(a)|package(b)"'));
  } finally { cleanup(root); }
});

test('controls: an aliased verb never merges with plain cargo test, and without an alias the merge is a nextest run', () => {
  const root = workspace();
  try {
    const mixed = ['cd rust && cargo t -p a --lib', 'cd rust && cargo test -p a --test x'];
    assert.deepEqual(cmds(mixed, root), mixed, 'two feature sets stay two commands');
    assert.deepEqual(cmds(['cargo t -p a --lib', 'cargo t -p a --test x'], root), ['cargo nextest run --no-fail-fast -p a --lib --test x'], 'no alias at this directory');
    assert.deepEqual(cmds(['cd rust && cargo t -p a --lib', 'cd rust && cargo t -p a --test x']), ['cd rust && cargo nextest run --no-fail-fast -p a --lib --test x'], 'no cwd given');
  } finally { cleanup(root); }
});
