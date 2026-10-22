// test-threads.test.mjs — nextest's -j is test threads, not build jobs (KIT-D104): the broker's `-j <jobs>` capped a
// nextest run at 3 concurrent tests (2948 s of test time in 1052 s of wall). `parallelism.test_threads` sets the
// width of nextest runs alone; cargo builds and plain `cargo test` keep `jobs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runsNextest } from './alias.mjs';
import { normalizeBroker } from './config.mjs';
import { buildEnv } from './prepush.mjs';
import { composeCommand } from './run.mjs';

function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'tt-'));
  mkdirSync(join(dir, '.cargo'));
  writeFileSync(join(dir, '.cargo', 'config.toml'), '[alias]\nt = "nextest run --workspace"\nb = "build"\n');
  return dir;
}

test('a nextest alias or `cargo nextest` takes test_threads as its -j; builds and plain cargo test keep jobs', () => {
  const cwd = checkout();
  assert.equal(composeCommand('cargo t -p x', { jobs: 3, testThreads: 12, cwd }), 'cargo nextest run -p x --no-fail-fast -j 12');
  assert.equal(composeCommand('cargo nextest run', { jobs: 3, testThreads: 12, cwd }), 'cargo nextest run -j 12');
  assert.equal(composeCommand('cargo b', { jobs: 3, testThreads: 12, cwd }), 'cargo b -j 3');
  assert.equal(composeCommand('cargo test -p x', { jobs: 3, testThreads: 12, cwd }), 'cargo test -p x --no-fail-fast -j 3');
});

test('control: without test_threads a nextest run keeps -j <jobs>, and an explicit -j stands', () => {
  const cwd = checkout();
  assert.equal(composeCommand('cargo t -p x', { jobs: 3, cwd }), 'cargo nextest run -p x --no-fail-fast -j 3');
  assert.equal(composeCommand('cargo t -p x -j 6', { jobs: 3, testThreads: 12, cwd }), 'cargo nextest run -p x -j 6 --no-fail-fast');
  assert.equal(runsNextest('cargo t', cwd), true);
  assert.equal(runsNextest('cargo b', cwd), false);
  assert.equal(runsNextest('echo hi', cwd), false);
});

test('config: parallelism.test_threads is read, and the pre-push gate gets NEXTEST_TEST_THREADS from it', () => {
  const set = normalizeBroker('/r', { parallelism: { jobs: 3, test_threads: 12 }, repos: [] });
  assert.equal(set.testThreads, 12);
  assert.equal(buildEnv(set).NEXTEST_TEST_THREADS, '12');
  const unset = normalizeBroker('/r', { parallelism: { jobs: 3 }, repos: [] });
  assert.equal(unset.testThreads, null);
  assert.equal(buildEnv(unset).NEXTEST_TEST_THREADS, undefined);
});
