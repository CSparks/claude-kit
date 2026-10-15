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

test('cargo t -p sim --lib expands the alias without --workspace and keeps the package', () => {
  const dir = project();
  try {
    assert.equal(packageScoped('cargo t -p sim --lib', dir), 'cargo nextest run --features fastdev -p sim --lib');
    assert.equal(packageScoped('cargo w --package sim', dir), 'cargo test --package sim');
    const composed = composeCommand('cargo t -p sim --lib', { jobs: 3, cwd: dir });
    assert.ok(!composed.includes('--workspace'), composed);
    assert.match(composed, /-p sim --lib/);
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
    assert.equal(packageScoped('cargo t -p sim -- --workspace', dir), 'cargo nextest run --features fastdev -p sim -- --workspace');
  } finally { cleanup(dir); }
});
