// build-guard.test.mjs — one build at a time per target dir, with its sources aligned first (KIT-T767, KIT-T769).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { enterBuild } from './build-guard.mjs';
import { g } from './patchkit.mjs';
import { cleanup, makeRepo, tempDir } from './testkit.mjs';

const OLD_S = 1_700_000_000;
const CARGO = 'cargo check';
const lockOf = (target) => join(target, 'broker', 'content', 'build.lock');

test('a command that is not cargo build-shaped takes no lock and aligns nothing', () => {
  const target = tempDir('guard-target-');
  try {
    const guard = enterBuild('node -e "1"', { cwd: target, targetDir: target });
    assert.equal(existsSync(lockOf(target)), false);
    assert.equal(guard.cancelled, false);
  } finally { cleanup(target); }
});

test('a second build waits for the first and is cancelled when asked; release frees the target', () => {
  const repo = makeRepo(tempDir('guard-repo-'));
  const target = tempDir('guard-target-');
  try {
    const first = enterBuild(CARGO, { cwd: repo, targetDir: target });
    assert.equal(existsSync(lockOf(target)), true);
    const second = enterBuild(CARGO, { cwd: repo, targetDir: target, shouldCancel: () => true, pollMs: 1 });
    assert.equal(second.cancelled, true, 'the waiter gave up');
    first.release();
    first.release();
    assert.equal(existsSync(lockOf(target)), false);
    const third = enterBuild(CARGO, { cwd: repo, targetDir: target });
    assert.equal(third.cancelled, false);
    third.release();
  } finally { cleanup(repo); cleanup(target); }
});

test('a lock whose holder is gone is taken over', () => {
  const repo = makeRepo(tempDir('guard-repo-'));
  const target = tempDir('guard-target-');
  try {
    mkdirSync(join(target, 'broker', 'content'), { recursive: true });
    writeFileSync(lockOf(target), JSON.stringify({ pid: 2 ** 22 + 1, host: hostname() }));
    const guard = enterBuild(CARGO, { cwd: repo, targetDir: target, shouldCancel: () => true, pollMs: 1 });
    assert.equal(guard.cancelled, false);
    guard.release();
  } finally { cleanup(repo); cleanup(target); }
});

test('entering a build touches the file the last build got from other source', () => {
  const repo = makeRepo(tempDir('guard-repo-'));
  const target = tempDir('guard-target-');
  try {
    utimesSync(join(repo, 'README'), OLD_S, OLD_S);
    enterBuild(CARGO, { cwd: repo, targetDir: target }).release();
    writeFileSync(join(repo, 'README'), 'patched\n');
    enterBuild(CARGO, { cwd: repo, targetDir: target }).release();
    g(['checkout', '--', 'README'], repo);
    utimesSync(join(repo, 'README'), OLD_S, OLD_S);
    const guard = enterBuild(CARGO, { cwd: repo, targetDir: target });
    assert.equal(guard.touched, 1);
    assert.ok(statSync(join(repo, 'README')).mtimeMs / 1000 > OLD_S);
    guard.release();
  } finally { cleanup(repo); cleanup(target); }
});
