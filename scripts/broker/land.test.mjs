// land.test.mjs — landing patches (KIT-T276 L4) against real git fixtures: path-only commits,
// push, no lane branches or worktrees, the dirty pause, and the submodule pin.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, g, originSha, snapshot } from './patchkit.mjs';
import { addOrigin, branchList, cleanup, makeRepo, tempDir, worktreeList } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const queued = (s, flags, env, extra = {}) => {
  const { job, result, error } = buildPatchJob(s.cfg, flags, env);
  assert.ok(job, JSON.stringify(result || error));
  writeJob(s.cfg, { ...job, ...extra });
  return job;
};
const treeCount = (cwd) => worktreeList(cwd).split(/\r?\n/).length;
const names = (cwd, ref = 'HEAD') => g(['show', '--name-only', '--pretty=format:', ref], cwd).split('\n').map((l) => l.trim()).filter(Boolean);

test('a green landing commits exactly the patch paths, pushes, and adds no branch or worktree', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, 'notes.md'), 'a hand-driven writer is thinking\n'); // untracked, not a blocking path
    const branches = branchList(s.root);
    const trees = treeCount(s.root);
    const job = queued(s, { ticket: 'T-9', title: 'rename beta', land: true }, `${envelope(['beta', 'BETA'])}*** write extra.txt\nhi\n`, { commands: [PASS] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'landed');
    assert.equal(r.phase, 'land');
    assert.equal(r.landed.sha, g(['rev-parse', 'HEAD'], s.root));
    assert.deepEqual(names(s.root).sort(), ['extra.txt', 'src.txt']);
    assert.equal(g(['log', '-1', '--pretty=%s'], s.root), 'rename beta (implements T-9)');
    assert.equal(originSha(s.bare, s.root), r.landed.sha, 'pushed');
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/\n?? notes.md', 'only unrelated untracked files are left');
    assert.deepEqual([branchList(s.root), treeCount(s.root)], [branches, trees]);
    assert.equal(listQueue(s.cfg).length, 0);
  } finally { s.done(); }
});

test('a landing patch without a ticket never touches the tree; submit refuses it too', () => {
  const s = fixture();
  try {
    const before = snapshot(s.root);
    const job = queued(s, { land: true }, envelope(['beta', 'BETA']), { commands: [PASS] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.match(r.message, /needs --ticket/);
    assert.deepEqual(snapshot(s.root), before);
    const cli = spawnSync(process.execPath, [join(import.meta.dirname, 'submit.mjs'), '--root', s.root, '--land'], { input: envelope(['beta', 'BETA']), encoding: 'utf8' });
    assert.equal(cli.status, 2);
  } finally { s.done(); }
});

test('a failing command bounces a landing patch: nothing committed, tree restored, log tail kept', () => {
  const s = fixture();
  try {
    const before = snapshot(s.root);
    const head = g(['rev-parse', 'HEAD'], s.root);
    const job = queued(s, { ticket: 'T-1', land: true }, envelope(['beta', 'BETA']), { commands: ['node -e "console.error(\'boom\'); process.exit(3)"'] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.equal(r.commands[0].exit, 3);
    assert.ok(r.commands[0].logTail.join('\n').includes('boom'));
    assert.equal(r.landed, null);
    assert.equal(g(['rev-parse', 'HEAD'], s.root), head);
    assert.equal(originSha(s.bare, s.root), head);
    assert.deepEqual(snapshot(s.root), before);
  } finally { s.done(); }
});

test('modified tracked files pause the queue; the job stays queued and runs once the tree is free', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, 'README'), 'hand-driven edit\n');
    const job = queued(s, {}, envelope(['beta', 'BETA']), { commands: [PASS] });
    const sum = processOnce(s.cfg);
    assert.deepEqual([sum.paused, sum.pausedOn], [true, job.id]);
    assert.equal(readResult(s.cfg, job.id).status, 'dirty');
    assert.equal(listQueue(s.cfg).length, 1, 'job stays queued');
    g(['checkout', 'README'], s.root);
    assert.equal(processOnce(s.cfg).paused, false);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
  } finally { s.done(); }
});

test('CARGO_TARGET_DIR is injected into command env', () => {
  const s = fixture();
  try {
    const job = queued(s, {}, envelope(['beta', 'BETA']), { commands: ['node -e "console.log(process.env.CARGO_TARGET_DIR || \'MISSING\')"'] });
    processOnce(s.cfg);
    assert.ok(readResult(s.cfg, job.id).commands[0].logTail.join('\n').includes(s.cfg.targetDir));
  } finally { s.done(); }
});

test('a write onto an existing untracked path is stale create-exists', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, 'mine.txt'), 'already here\n');
    const out = buildPatchJob(s.cfg, {}, '*** write mine.txt\nnew\n');
    assert.equal(out.result.stale[0].reason, 'create-exists');
  } finally { s.done(); }
});

test('submodule landing commits in the submodule, pushes it, and pins the superproject by path only', () => {
  const subOriginDir = tempDir('sub-bare-');
  const subSrc = makeRepo(tempDir('sub-src-'));
  const subBare = addOrigin(subSrc, join(subOriginDir, 'sub.git')).replace(/\\/g, '/');
  const superRoot = makeRepo(tempDir('super-root-'));
  const superBareDir = tempDir('super-bare-');
  const superBare = addOrigin(superRoot, join(superBareDir, 'super.git'));
  g(['-c', 'protocol.file.allow=always', 'submodule', 'add', subBare, 'rapid-game'], superRoot);
  g(['commit', '-m', 'add submodule'], superRoot);
  g(['push', 'origin', 'main'], superRoot);
  const subPath = join(superRoot, 'rapid-game');
  g(['checkout', 'main'], subPath);
  for (const [k, v] of [['user.email', 'broker@test'], ['user.name', 'Broker Test'], ['commit.gpgsign', 'false']]) g(['config', k, v], subPath);
  writeFileSync(join(superRoot, 'README'), 'stray edit in super\n');

  const cfg = normalizeBroker(superRoot, {
    repos: [
      { name: 'super', path: '.', main: 'main', remote: 'origin' },
      { name: 'rapid-game', path: 'rapid-game', main: 'main', remote: 'origin', submodule: true, pin_in: '.' },
    ],
    verify_default: [PASS],
  });
  try {
    const { job } = buildPatchJob(cfg, { repo: 'rapid-game', ticket: 'ST-T1', title: 'sub feat', land: true }, '*** write s.txt\nsub feature\n');
    writeJob(cfg, job);
    processOnce(cfg);
    const r = readResult(cfg, job.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.ok(r.landed.sha && r.landed.superSha, 'sub sha and superproject pin recorded');
    assert.deepEqual(names(subPath), ['s.txt']);
    assert.equal(g(['--git-dir', subBare, 'rev-parse', 'main'], superRoot), r.landed.sha, 'submodule pushed');
    assert.deepEqual(names(superRoot), ['rapid-game'], 'pin commit touches only the submodule pointer');
    const subject = g(['log', '-1', '--pretty=%s'], superRoot);
    assert.ok(subject.includes('[no-log: submodule pin]') && subject.includes('ST-T1'));
    assert.ok(g(['status', '--porcelain'], superRoot).includes('README'), 'stray edit left uncommitted');
    assert.equal(g(['--git-dir', superBare, 'rev-parse', 'main'], superRoot), g(['rev-parse', 'HEAD'], superRoot), 'super pushed');
  } finally {
    cleanup(superRoot); cleanup(subSrc); cleanup(subOriginDir); cleanup(superBareDir);
  }
});
