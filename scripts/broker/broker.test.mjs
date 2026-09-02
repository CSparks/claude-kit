// broker.test.mjs — the queue engine against real git fixtures (see testkit.mjs). Covers the
// whole protocol on throwaway repos whose "build" commands are plain node -e, so it runs in
// seconds without cargo: clean run + land, failing bounce, rebase conflict, dirty pause +
// restart re-queue, CARGO_TARGET_DIR injection, and a pathspec-only submodule re-pin.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { writeJob, listQueue, readResult } from './result.mjs';
import {
  g, tempDir, cleanup, makeRepo, addOrigin, makeLane, commitOnMain, currentBranchOf, branchList,
} from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';

function setup(verifyDefault = [PASS], extraRepos = []) {
  const root = makeRepo(tempDir('broker-root-'));
  const bareDir = tempDir('broker-bare-');
  const bare = addOrigin(root, join(bareDir, 'origin.git'));
  const cfg = normalizeBroker(root, {
    repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }, ...extraRepos],
    verify_default: verifyDefault,
  });
  return { root, bare, cfg, done: () => { cleanup(root); cleanup(bareDir); } };
}
const originSha = (bare, cwd) => g(['--git-dir', bare, 'rev-parse', 'main'], cwd);

test('clean run + land: ff-merge, push, branch + worktree torn down', () => {
  const s = setup();
  const wtDir = join(tempDir('broker-wt-'), 'lane');
  makeLane(s.root, 'lane/x', wtDir, 'feat.txt', 'hi\n');
  try {
    writeJob(s.cfg, { id: 'j1', repo: 'app', branch: 'lane/x', commands: [PASS], land: true, ticket: 'T-1', title: 'feat', worktree: wtDir });
    const sum = processOnce(s.cfg);
    assert.equal(sum.paused, false);
    const r = readResult(s.cfg, 'j1');
    assert.equal(r.status, 'passed');
    assert.ok(r.landed && r.landed.sha, 'landed sha recorded');
    assert.equal(originSha(s.bare, s.root), r.landed.sha, 'origin main fast-forwarded');
    assert.ok(!branchList(s.root).includes('lane/x'), 'lane branch deleted');
    assert.equal(existsSync(wtDir), false, 'worker worktree removed');
    assert.equal(existsSync(join(s.root, 'feat.txt')), true, 'feature merged onto main');
    assert.equal(listQueue(s.cfg).length, 0, 'job left the queue');
    assert.equal(currentBranchOf(s.root), 'main', 'checkout back on main');
  } finally {
    s.done();
  }
});

test('failing command: bounced with log tail, nothing landed', () => {
  const s = setup();
  const wtDir = join(tempDir('broker-wt-'), 'lane');
  makeLane(s.root, 'lane/f', wtDir, 'f.txt', 'x');
  const before = originSha(s.bare, s.root);
  try {
    writeJob(s.cfg, { id: 'j2', repo: 'app', branch: 'lane/f', commands: ['node -e "console.error(\'boom\'); process.exit(3)"'], land: true, worktree: wtDir });
    processOnce(s.cfg);
    const r = readResult(s.cfg, 'j2');
    assert.equal(r.status, 'failed');
    assert.equal(r.commands[0].exit, 3);
    assert.ok(r.commands[0].logTail.join('\n').includes('boom'), 'log tail captured');
    assert.equal(r.landed, null);
    assert.equal(originSha(s.bare, s.root), before, 'origin unchanged');
    assert.ok(branchList(s.root).includes('lane/f'), 'lane branch retained');
    assert.equal(currentBranchOf(s.root), 'main');
  } finally {
    s.done();
  }
});

test('rebase conflict: bounced with the conflict list', () => {
  const s = setup();
  commitOnMain(s.root, 'c.txt', 'base\n', 'add c');
  const wtDir = join(tempDir('broker-wt-'), 'lane');
  makeLane(s.root, 'lane/c', wtDir, 'c.txt', 'lane\n');
  commitOnMain(s.root, 'c.txt', 'main\n', 'main edits c');
  try {
    writeJob(s.cfg, { id: 'j3', repo: 'app', branch: 'lane/c', land: false, worktree: wtDir });
    processOnce(s.cfg);
    const r = readResult(s.cfg, 'j3');
    assert.equal(r.status, 'conflict');
    assert.ok(r.conflicts.includes('c.txt'), 'conflicting path reported');
    assert.equal(r.commands.length, 0, 'no commands run on a conflict');
    assert.equal(currentBranchOf(s.root), 'main', 'rebase aborted, back on main');
  } finally {
    s.done();
  }
});

test('dirty checkout: pauses the queue, job re-queued, then a restart drains it', () => {
  const s = setup();
  const wtDir = join(tempDir('broker-wt-'), 'lane');
  makeLane(s.root, 'lane/d', wtDir, 'd.txt', 'x');
  writeFileSync(join(s.root, 'wip.txt'), 'hand-driven writer mid-edit');
  try {
    writeJob(s.cfg, { id: 'j4', repo: 'app', branch: 'lane/d', commands: [PASS], land: false, worktree: wtDir });
    const sum = processOnce(s.cfg);
    assert.equal(sum.paused, true);
    assert.equal(sum.pausedOn, 'j4');
    const r = readResult(s.cfg, 'j4');
    assert.equal(r.status, 'dirty');
    assert.ok(r.dirtyEntries.some((e) => e.includes('wip.txt')));
    assert.equal(listQueue(s.cfg).length, 1, 'job stays queued (re-queue guarantee)');

    rmSync(join(s.root, 'wip.txt')); // writer says "checkout free"
    const sum2 = processOnce(s.cfg); // restart drains it
    assert.equal(sum2.paused, false);
    assert.equal(readResult(s.cfg, 'j4').status, 'passed');
    assert.equal(listQueue(s.cfg).length, 0);
  } finally {
    s.done();
  }
});

test('CARGO_TARGET_DIR is injected into command env', () => {
  const s = setup(['node -e "console.log(process.env.CARGO_TARGET_DIR || \'MISSING\')"']);
  const wtDir = join(tempDir('broker-wt-'), 'lane');
  makeLane(s.root, 'lane/e', wtDir, 'e.txt', 'x');
  try {
    writeJob(s.cfg, { id: 'j5', repo: 'app', branch: 'lane/e', land: false, worktree: wtDir });
    processOnce(s.cfg);
    const r = readResult(s.cfg, 'j5');
    assert.equal(r.status, 'passed');
    assert.ok(r.commands[0].logTail.join('\n').includes(s.cfg.targetDir), 'shared target dir seen by the command');
  } finally {
    s.done();
  }
});

test('submodule land: superproject re-pin is pathspec-only, stray changes untouched', () => {
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
  const subWtDir = join(tempDir('sub-wt-'), 'lane');
  makeLane(subPath, 'lane/s', subWtDir, 's.txt', 'sub feature\n');
  writeFileSync(join(superRoot, 'README'), 'stray edit in super\n'); // unstaged noise

  const cfg = normalizeBroker(superRoot, {
    repos: [
      { name: 'super', path: '.', main: 'main', remote: 'origin' },
      { name: 'rapid-game', path: 'rapid-game', main: 'main', remote: 'origin', submodule: true, pin_in: '.' },
    ],
    verify_default: [PASS],
  });
  try {
    writeJob(cfg, { id: 'js', repo: 'rapid-game', branch: 'lane/s', commands: [PASS], land: true, ticket: 'ST-T1', title: 'sub feat', worktree: subWtDir });
    processOnce(cfg);
    const r = readResult(cfg, 'js');
    assert.equal(r.status, 'passed');
    assert.ok(r.landed && r.landed.superSha, 'superproject re-pinned');

    const touched = g(['show', '--name-only', '--pretty=format:', 'HEAD'], superRoot).split('\n').map((l) => l.trim()).filter(Boolean);
    assert.deepEqual(touched, ['rapid-game'], 'pin commit touches ONLY the submodule pointer');
    const subject = g(['log', '-1', '--pretty=%s'], superRoot);
    assert.ok(subject.includes('[no-log: submodule pin]') && subject.includes('ST-T1'), 'pin message shape');
    assert.ok(g(['status', '--porcelain'], superRoot).includes('README'), 'stray README edit left uncommitted');
    assert.equal(g(['--git-dir', superBare, 'rev-parse', 'main'], superRoot), g(['rev-parse', 'HEAD'], superRoot), 'super pushed');
  } finally {
    cleanup(superRoot); cleanup(subSrc); cleanup(subOriginDir); cleanup(superBareDir);
  }
});
