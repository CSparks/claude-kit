// cargo-scope-dirs.mjs — the paths a cargo build compiles, recorded in its build hold (KIT-T1114).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquireBuildSlot } from './build-slot.mjs';
import { compiledPaths, selection } from './cargo-scope-dirs.mjs';

const lower = (list) => list.map((p) => resolve(p).replace(/\\/g, '/').toLowerCase());

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'csd-'));
  const crates = { a: ['b'], b: [], c: [] };
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nresolver = "2"\nmembers = ["crates/a", "crates/b", "crates/c"]\n');
  for (const [name, deps] of Object.entries(crates)) {
    mkdirSync(join(root, 'crates', name, 'src'), { recursive: true });
    const depText = deps.map((d) => `${d} = { path = "../${d}" }`).join('\n');
    writeFileSync(join(root, 'crates', name, 'Cargo.toml'), `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${depText}\n`);
    writeFileSync(join(root, 'crates', name, 'src', 'lib.rs'), '');
  }
  return root;
}

test('selection reads -p, --package, --workspace and --all from the command line', () => {
  assert.deepEqual(selection(['test', '-p', 'a', '--package=b', '-p=c']), { names: ['a', 'b', 'c'], workspace: false });
  assert.deepEqual(selection(['build', '--workspace', '--exclude', 'x']), { names: [], workspace: true });
  assert.deepEqual(selection(['test', '--', '-p', 'ignored']), { names: [], workspace: false });
});

test('-p a scopes a and its path dependency b, never c, plus the workspace manifest and lock', () => {
  const root = workspace();
  const scope = lower(compiledPaths(['test', '-p', 'a'], root));
  for (const want of ['crates/a', 'crates/b', 'Cargo.toml', 'Cargo.lock']) assert.ok(scope.some((p) => p.endsWith(`/${want.toLowerCase()}`)), want);
  assert.ok(!scope.some((p) => p.endsWith('/crates/c')), 'negative control: c is not compiled');
});

test('--workspace scopes every member; no selection inside a member scopes that member and its dependencies', () => {
  const root = workspace();
  assert.ok(['a', 'b', 'c'].every((n) => lower(compiledPaths(['check', '--workspace'], root)).some((p) => p.endsWith(`/crates/${n}`))));
  const inB = lower(compiledPaths(['check'], join(root, 'crates', 'b')));
  assert.ok(inB.some((p) => p.endsWith('/crates/b')) && !inB.some((p) => p.endsWith('/crates/a')));
});

test('metadata that cannot be read leaves the whole working directory as the scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'csd-none-'));
  assert.deepEqual(lower(compiledPaths(['test'], root)), lower([root]));
});

test('a build hold carries the scope and writer it was acquired with', () => {
  const dir = mkdtempSync(join(tmpdir(), 'csd-slots-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  const slot = acquireBuildSlot('cargo test', { jobs: 1, force: true, probes: { physicalCores: () => 8, commitFreeBytes: () => Infinity, gameRunning: () => false }, meta: { scope: ['/x/crates/a'], writer: 'S1|agentA' } });
  const file = readdirSync(dir).find((n) => n.startsWith('slot-'));
  const held = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  slot.release();
  assert.deepEqual([held.scope, held.writer], [['/x/crates/a'], 'S1|agentA']);
});
