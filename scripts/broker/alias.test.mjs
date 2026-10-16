// alias.test.mjs — a `-p <crate>` check runs only that crate (KIT-T516): a workspace-wide cargo alias
// is expanded without `--workspace` when the command names a package. Controls: no `-p` keeps the
// alias (the workspace run is meant), and an alias without the flag is left alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageScoped, readAliases } from './alias.mjs';
import { composeCommand } from './run.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const CONFIG = [
  '[build]', 'jobs = 24', '',
  '[alias]',
  't = "nextest run --workspace --features fastdev"',
  'b = "build --features fastdev,dlss"',
  'e = ["run", "-p", "editor", "--features", "fastdev"]',
  'w = ["test", "--workspace"]',
  '',
  '[env]', 'X = "1"',
].join('\n');

function project() {
  const dir = tempDir('alias-');
  mkdirSync(join(dir, '.cargo'));
  writeFileSync(join(dir, '.cargo', 'config.toml'), CONFIG);
  return dir;
}

test('reads string and array aliases from the [alias] section only', () => {
  const dir = project();
  try {
    const a = readAliases(dir);
    assert.deepEqual(a.t, ['nextest', 'run', '--workspace', '--features', 'fastdev']);
    assert.deepEqual(a.e, ['run', '-p', 'editor', '--features', 'fastdev']);
    assert.equal(a.X, undefined, 'keys of other sections are not aliases');
  } finally { cleanup(dir); }
});

test('cargo t -p sim --lib expands a feature alias with a package filterset, a plain alias without --workspace', () => {
  const dir = project();
  try {
    assert.equal(packageScoped('cargo t -p sim --lib', dir), 'cargo nextest run --workspace --features fastdev --lib -E "package(sim)"');
    assert.equal(packageScoped('cargo w --package sim', dir), 'cargo test --package sim');
    const composed = composeCommand('cargo t -p sim --lib', { jobs: 3, cwd: dir });
    assert.match(composed, /--workspace --features fastdev/, 'the alias feature set is unchanged');
    assert.ok(!/ -p /.test(composed), composed);
    assert.ok(composed.includes('-E "package(sim)"'), composed);
    assert.match(composed, /--no-fail-fast/, 'a test alias still runs every test');
  } finally { cleanup(dir); }
});

test('controls: without -p the alias stays workspace-wide; an alias without the flag, a plain cargo test and no config are untouched', () => {
  const dir = project();
  try {
    assert.equal(packageScoped('cargo t --lib', dir), 'cargo t --lib');
    assert.equal(packageScoped('cargo b -p game', dir), 'cargo b -p game');
    assert.equal(packageScoped('cargo test -p sim', dir), 'cargo test -p sim');
    assert.equal(packageScoped('cargo t -p sim', tempDir('noconfig-')), 'cargo t -p sim');
    assert.match(composeCommand('cargo t --lib', { jobs: 3, cwd: dir }), /^cargo t --lib/);
    assert.equal(packageScoped('cargo t -p sim -- --workspace', dir), 'cargo nextest run --workspace --features fastdev -E "package(sim)" -- --workspace');
  } finally { cleanup(dir); }
});

test('a package without the alias feature is filtered, never given --features alone (KIT-T527)', () => {
  const dir = project();
  try {
    const out = packageScoped('cargo t -p workspace-guards -p sim', dir);
    assert.equal(out, 'cargo nextest run --workspace --features fastdev -E "package(workspace-guards)|package(sim)"');
    assert.ok(!/ -p /.test(out), 'no -p beside --features');
  } finally { cleanup(dir); }
});

test('a command that cds into the cargo workspace reads that directory\'s alias (rapid-game lane: cd rust && cargo t -p X)', () => {
  const root = tempDir('alias-lane-');
  try {
    mkdirSync(join(root, 'rust', '.cargo'), { recursive: true });
    writeFileSync(join(root, 'rust', '.cargo', 'config.toml'), '[alias]\nt = "nextest run --workspace --features rg-engine/dynamic_linking"\n');
    const composed = composeCommand('cd rust && cargo t -p rg-tunables', { jobs: 3, cwd: root });
    assert.match(composed, /^cd rust && cargo nextest run --workspace --features rg-engine\/dynamic_linking/);
    assert.ok(composed.includes('-E "package(rg-tunables)"'), composed);
    assert.ok(!/ -p /.test(composed), composed);
    assert.equal(packageScoped('cd rust && cargo t --lib', root), 'cd rust && cargo t --lib', 'control: no -p keeps the alias');
    assert.equal(packageScoped('cargo t -p rg-tunables', root), 'cargo t -p rg-tunables', 'control: without the cd the root has no alias');
  } finally { cleanup(root); }
});
