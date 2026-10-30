// alias-closure.test.mjs — a `-p <crate>` check of a crate the alias's `--features pkg/feat` cannot reach builds only that
// crate (KIT-T729). rapid-game's `cargo t -p rg-ui --lib` (rg-ui has no Bevy) expanded to `--workspace --features
// rg-engine/dynamic_linking` and compiled the unit tests of every workspace library behind rg-ui: 396 s for ten crates.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageScoped } from './alias.mjs';
import { dependenciesOf, readLock } from './cargo-lock.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const LOCK = [
  ['rg-engine', ['bevy']], ['rg-ui', ['serde']], ['rg-ui-bevy', ['rg-ui', 'rg-engine']], ['rg-graphics', ['rg-ui-bevy']], ['rg-screens', ['rg-ui']],
  ['bevy', []], ['serde', []],
].map(([name, deps]) => `[[package]]\nname = "${name}"\nversion = "0.1.0"\n${/^rg-/.test(name) ? '' : 'source = "registry+https://github.com/rust-lang/crates.io-index"\n'}dependencies = [${deps.map((d) => `\n "${d}",`).join('')}\n]\n`).join('\n');

function workspace(alias) {
  const root = tempDir('alias-closure-');
  mkdirSync(join(root, 'rust', '.cargo'), { recursive: true });
  writeFileSync(join(root, 'rust', '.cargo', 'config.toml'), `[alias]\nt = "${alias}"\n`);
  writeFileSync(join(root, 'rust', 'Cargo.lock'), LOCK);
  return root;
}

const FEATURE_ALIAS = 'nextest run --workspace --features rg-engine/dynamic_linking';
const cmd = (pkgs) => `cd rust && cargo t ${pkgs.map((p) => `-p ${p}`).join(' ')} --lib pad_`;

test('dependenciesOf walks the lock forward and includes the named packages', () => {
  const root = workspace(FEATURE_ALIAS);
  try { assert.deepEqual([...dependenciesOf(readLock(join(root, 'rust', 'Cargo.lock')), ['rg-graphics'])].sort(), ['bevy', 'rg-engine', 'rg-graphics', 'rg-ui', 'rg-ui-bevy', 'serde']); } finally { cleanup(root); }
});

test('crates that never reach the feature package build alone, with no --workspace and no --features', () => {
  const root = workspace(FEATURE_ALIAS);
  try {
    assert.equal(packageScoped(cmd(['rg-ui']), root), 'cd rust && cargo nextest run -p rg-ui --lib pad_');
    assert.equal(packageScoped(cmd(['rg-ui', 'rg-screens']), root), 'cd rust && cargo nextest run -p rg-ui -p rg-screens --lib pad_');
  } finally { cleanup(root); }
});

test('controls: one crate that reaches the feature package keeps the workspace feature set; a bare feature name and a missing lock are untouched', () => {
  const root = workspace(FEATURE_ALIAS);
  try {
    const kept = 'cd rust && cargo nextest run --workspace --features rg-engine/dynamic_linking --lib pad_ -E "package(rg-ui)|package(rg-graphics)"';
    assert.equal(packageScoped(cmd(['rg-ui', 'rg-graphics']), root), kept);
    assert.match(packageScoped(cmd(['rg-ui-bevy']), root), /--workspace --features rg-engine\/dynamic_linking/);
  } finally { cleanup(root); }
  const bare = workspace('nextest run --workspace --features fastdev');
  try { assert.match(packageScoped(cmd(['rg-ui']), bare), /--workspace --features fastdev/); } finally { cleanup(bare); }
  const nolock = workspace(FEATURE_ALIAS);
  try {
    writeFileSync(join(nolock, 'rust', 'Cargo.lock'), '');
    assert.match(packageScoped(cmd(['rg-ui']), nolock), /--workspace --features/);
  } finally { cleanup(nolock); }
});
