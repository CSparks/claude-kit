// KIT-T160: API markdown writes auto-commit — debounced, pathspec-limited, switchable, fail-open.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { scheduleStoreCommit, flushStoreCommits } from './store-commit.mjs';

process.env.KIT_API_AUTOCOMMIT_DELAY_MS = '0';

const git = (root, ...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout || '';

function tempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kit-store-commit-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'root');
  mkdirSync(join(root, '.ai'), { recursive: true });
  return root;
}

const log = (root) => git(root, 'log', '--format=%s').trim().split('\n').filter(Boolean);
const filesOf = (root, ref) => git(root, 'show', '--name-only', '--format=', ref).trim().split('\n').filter(Boolean);

test('a write in a git repo yields one commit containing only the store path', async () => {
  const root = tempRepo();
  writeFileSync(join(root, '.ai', 'ticket.md'), 'x\n');
  writeFileSync(join(root, 'unrelated.txt'), 'y\n'); // negative control: outside the pathspec
  assert.equal(scheduleStoreCommit(join(root, '.ai'), 'comment KIT-T160'), true);
  await flushStoreCommits();

  const subjects = log(root);
  assert.equal(subjects.length, 2, 'exactly one new commit');
  assert.equal(subjects[0], 'ui: comment KIT-T160 [no-log: api write]');
  assert.deepEqual(filesOf(root, 'HEAD'), ['.ai/ticket.md']);
  assert.match(git(root, 'status', '--porcelain'), /unrelated\.txt/);
  rmSync(root, { recursive: true, force: true });
});

test('two rapid writes coalesce into one commit', async () => {
  const root = tempRepo();
  writeFileSync(join(root, '.ai', 'a.md'), 'a\n');
  scheduleStoreCommit(join(root, '.ai'), 'comment A');
  writeFileSync(join(root, '.ai', 'b.md'), 'b\n');
  scheduleStoreCommit(join(root, '.ai'), 'comment B');
  await flushStoreCommits();

  const subjects = log(root);
  assert.equal(subjects.length, 2, 'the burst produced ONE commit');
  assert.equal(subjects[0], 'ui: 2 api writes [no-log: api write]');
  assert.deepEqual(filesOf(root, 'HEAD').sort(), ['.ai/a.md', '.ai/b.md']);
  rmSync(root, { recursive: true, force: true });
});

test('a dir outside any git repo is a no-op', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-store-nogit-'));
  // A temp dir can sit under a repo on some hosts; only assert when it truly is not one.
  const inRepo = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir }).status === 0;
  if (!inRepo) assert.equal(scheduleStoreCommit(dir, 'comment X'), false);
  await flushStoreCommits();
  rmSync(dir, { recursive: true, force: true });
});

test('KIT_API_AUTOCOMMIT=0 disables the auto-commit', async () => {
  const root = tempRepo();
  writeFileSync(join(root, '.ai', 'c.md'), 'c\n');
  process.env.KIT_API_AUTOCOMMIT = '0';
  try {
    assert.equal(scheduleStoreCommit(join(root, '.ai'), 'comment C'), false);
    await flushStoreCommits();
  } finally {
    delete process.env.KIT_API_AUTOCOMMIT;
  }
  assert.equal(log(root).length, 1, 'nothing committed');
  assert.match(git(root, 'status', '--porcelain', '-uall'), /c\.md/);
  rmSync(root, { recursive: true, force: true });
});

test('a git failure never throws at the caller', async () => {
  const root = tempRepo();
  writeFileSync(join(root, '.ai', 'd.md'), 'd\n');
  scheduleStoreCommit(join(root, '.ai'), 'comment D');
  rmSync(root, { recursive: true, force: true }); // the repo vanishes before the debounce fires
  await assert.doesNotReject(flushStoreCommits());
});
