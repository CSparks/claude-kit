// runner.test.mjs — the test runner (KIT-T570): every tracked test file is in the manifest, times are
// recorded and ordered longest first, and a failing file fails the run by name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTests } from './discover.mjs';
import { longestFirst, readTimes, slowest, writeTimes } from './times.mjs';

const KIT = join(import.meta.dirname, '..', '..');
const RUNNER = join(KIT, 'scripts', 'run-tests.mjs');

function fixtureRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'runner-fx-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

const runner = (root, args = [], env = {}) => spawnSync(process.execPath, [RUNNER, '--root', root, ...args], {
  encoding: 'utf8', env: { ...process.env, KIT_TEST_TIMES: join(root, 'times.json'), ...env },
});

test('every git-tracked *.test.mjs is in the manifest, including files the old chain never ran', () => {
  const tracked = execFileSync('git', ['ls-files', '*.test.mjs'], { cwd: KIT, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  const manifest = discoverTests(KIT);
  assert.deepEqual(tracked.filter((f) => !manifest.includes(f)), []);
  for (const orphan of ['hooks/agent-reconcile.test.mjs', 'hooks/lib/frameworks.test.mjs', 'hooks/license-guard.test.mjs', 'scripts/capability-research.test.mjs', 'scripts/t-refresh.test.mjs']) {
    assert.ok(manifest.includes(orphan), `${orphan} is run`);
  }
  assert.equal(new Set(manifest).size, manifest.length, 'no file twice');
});

test('an exported tree (no .git) is walked: tests found, node_modules and frameworks skipped', () => {
  const root = fixtureRoot({ 'a/one.test.mjs': '', 'b.test.mjs': '', 'node_modules/x/dep.test.mjs': '', 'frameworks/f/other.test.mjs': '', 'notes.md': '' });
  assert.deepEqual(discoverTests(root), ['a/one.test.mjs', 'b.test.mjs']);
});

test('times merge over the stored file, slowest sorts, and unknown files lead the longest-first order', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'times-')), 'sub', 'times.json');
  writeTimes(file, [{ file: 'a', ms: 10.4 }, { file: 'b', ms: 900 }]);
  writeTimes(file, [{ file: 'c', ms: 50 }]);
  assert.deepEqual(readTimes(file), { a: 10, b: 900, c: 50 });
  assert.deepEqual(slowest([{ file: 'a', ms: 1 }, { file: 'b', ms: 5 }, { file: 'c', ms: 3 }], 2).map((r) => r.file), ['b', 'c']);
  assert.deepEqual(longestFirst(['a', 'b', 'c', 'new'], readTimes(file)), ['new', 'b', 'c', 'a']);
  assert.deepEqual(readTimes(join(tmpdir(), 'no-such-times.json')), {});
});

test('a failing file fails the run and is named; the passing file is timed and the slowest are printed', () => {
  const root = fixtureRoot({ 'pass.test.mjs': 'process.exit(0);', 'sub/bad.test.mjs': 'console.log("boom-marker"); process.exit(3);' });
  const r = runner(root);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL .*sub\/bad\.test\.mjs/);
  assert.match(r.stdout, /boom-marker/);
  assert.match(r.stdout, /1 FAILED: sub\/bad\.test\.mjs/);
  assert.match(r.stdout, /slowest 10 \(of 2 files/);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(root, 'times.json'), 'utf8')).files).sort(), ['pass.test.mjs', 'sub/bad.test.mjs']);
});

test('control: all files passing exits 0', () => {
  const root = fixtureRoot({ 'a.test.mjs': '', 'b.test.mjs': '' });
  assert.equal(runner(root).status, 0);
});
