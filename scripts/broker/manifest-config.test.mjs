// manifest-config.mjs — a cargo command whose --manifest-path points into a workspace with its own .cargo/ the working directory will not load.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandConfigWarnings, unloadedConfigs } from './manifest-config.mjs';

function layout() {
  const base = mkdtempSync(join(tmpdir(), 'mc-'));
  const demo = join(base, 'demo');
  const ws = join(demo, 'framework', 'rust');
  mkdirSync(join(ws, '.cargo'), { recursive: true });
  writeFileSync(join(ws, '.cargo', 'config.toml'), '[build]\njobs = 24\n');
  writeFileSync(join(ws, 'Cargo.toml'), '[workspace]\n');
  mkdirSync(join(demo, '.cargo'), { recursive: true });
  writeFileSync(join(demo, '.cargo', 'config.toml'), '[build]\n');
  return { base, demo, ws };
}
const cargoHome = (base) => join(base, 'cargo-home');

test('a manifest path into a workspace with its own .cargo, run from another root, names that .cargo', () => {
  const { base, demo, ws } = layout();
  const found = unloadedConfigs(['test', '-p', 'x', '--manifest-path', 'framework/rust/Cargo.toml'], demo, cargoHome(base));
  assert.deepEqual(found, [join(ws, '.cargo')]);
  assert.deepEqual(unloadedConfigs(['test', `--manifest-path=${join(ws, 'Cargo.toml')}`], demo, cargoHome(base)), [join(ws, '.cargo')]);
});

test('no warning when the working directory is that workspace, below it, or no manifest path is given', () => {
  const { base, demo, ws } = layout();
  assert.deepEqual(unloadedConfigs(['test', '--manifest-path', 'Cargo.toml'], ws, cargoHome(base)), []);
  assert.deepEqual(unloadedConfigs(['test', '--manifest-path', join(ws, 'Cargo.toml')], join(ws, 'crates'), cargoHome(base)), []);
  assert.deepEqual(unloadedConfigs(['test', '-p', 'x'], demo, cargoHome(base)), []);
  assert.deepEqual(unloadedConfigs(['test', '--', '--manifest-path', 'framework/rust/Cargo.toml'], demo, cargoHome(base)), [], 'after -- is the test binary\'s');
});

test('a command string is read per cargo segment, and a leading cd moves the working directory', () => {
  const { base, demo, ws } = layout();
  const home = cargoHome(base);
  const from = (command) => commandConfigWarnings(command, demo, home);
  assert.equal(from('cargo test --manifest-path framework/rust/Cargo.toml 2>&1 | tail -30').length, 1);
  assert.match(from('cargo test --manifest-path framework/rust/Cargo.toml')[0], /cd .*rust && cargo/);
  assert.match(from('cargo test --manifest-path framework/rust/Cargo.toml')[0], /rust[\\/]\.cargo/);
  assert.deepEqual(from(`cd "${ws.replace(/\\/g, '/')}" && cargo test -p x --manifest-path Cargo.toml`), []);
  assert.deepEqual(from('node probe.mjs --manifest-path framework/rust/Cargo.toml'), [], 'only cargo commands');
});
