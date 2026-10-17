// no-orphan.test.mjs — no landing ever orphans a commit (KIT-D097). Checkouts need no coordination:
// the remote's refusal and the rebase settle a race, so what must hold is that neither side's work
// becomes unreachable. A landing whose push cannot complete keeps its commit on refs/broker/undone/
// and names it; a lane never moves a tree whose detached commits are on no branch; a gitlink is never
// committed for a commit that exists only locally.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { laneConfigs, repoByName } from './config.mjs';
import { unpushedGitlink } from './pin.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture, g, originSha } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const isAncestor = (cwd, a, b) => { try { g(['merge-base', '--is-ancestor', a, b], cwd); return true; } catch { return false; } };

function pushFromElsewhere(s, file, text) {
  const other = tempDir('orphan-other-');
  g(['clone', '-q', s.bare, other], s.root);
  for (const [k, v] of [['user.email', 'o@test'], ['user.name', 'Other'], ['commit.gpgsign', 'false']]) g(['config', k, v], other);
  commitOnMain(other, file, text, `other: ${file}`);
  g(['push', 'origin', 'main'], other);
  const sha = g(['rev-parse', 'HEAD'], other);
  cleanup(other);
  return sha;
}

function refuseEveryPush(s) {
  const dir = tempDir('orphan-hooks-');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pre-push'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'pre-push'), 0o755);
  g(['config', 'core.hooksPath', dir], s.root);
  return () => cleanup(dir);
}

function land(s, env) {
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-9', title: 'change', land: true }, env);
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
}

const keptRef = (r) => /kept at (refs\/broker\/undone\/\S+), ([0-9a-f]{10})\)/.exec(r.message || '');

test('a push that fails after a rebase keeps the rebased commit on a ref the result names, and never drops the other checkout commit', () => {
  const s = fixture();
  let undo = () => {};
  try {
    const theirs = pushFromElsewhere(s, 'elsewhere.txt', 'moved\n');
    undo = refuseEveryPush(s);
    const r = land(s, envelope(['beta', 'BETA']));
    assert.equal(r.status, 'failed', JSON.stringify(r));
    const kept = keptRef(r);
    assert.ok(kept, r.message);
    assert.equal(g(['rev-parse', kept[1]], s.root).slice(0, 10), kept[2], 'the ref holds the sha the result names');
    assert.ok(isAncestor(s.root, theirs, kept[1]), 'the kept work sits on the other checkout commit');
    assert.match(g(['log', '-1', '--format=%s', kept[1]], s.root), /implements T-9/);
    assert.equal(originSha(s.bare, s.root), theirs, 'the other checkout commit is still the remote tip');
    assert.equal(g(['rev-parse', 'HEAD'], s.root), theirs);
  } finally { undo(); s.done(); }
});

test('a push refused before any rebase keeps the commit on a ref as well', () => {
  const s = fixture();
  let undo = () => {};
  try {
    undo = refuseEveryPush(s);
    const r = land(s, envelope(['beta', 'BETA']));
    assert.equal(r.status, 'failed', JSON.stringify(r));
    const kept = keptRef(r);
    assert.ok(kept, r.message);
    assert.equal(g(['rev-parse', kept[1]], s.root).slice(0, 10), kept[2]);
    assert.equal(g(['rev-parse', 'HEAD'], s.root), originSha(s.bare, s.root), 'the tree is back at the remote tip');
  } finally { undo(); s.done(); }
});

test('a conflicting rebase keeps the dropped commit on a ref and leaves the other commit on the remote', () => {
  const s = fixture();
  try {
    const theirs = pushFromElsewhere(s, 'src.txt', 'alpha\nbravo\ngamma\n');
    const r = land(s, envelope(['beta', 'BETA']));
    assert.equal(r.status, 'conflict', JSON.stringify(r));
    const kept = keptRef(r);
    assert.ok(kept, r.message);
    assert.match(g(['log', '-1', '--format=%s', kept[1]], s.root), /implements T-9/);
    assert.equal(originSha(s.bare, s.root), theirs);
  } finally { s.done(); }
});

test('control: a landing that pushes leaves no undone ref', () => {
  const s = fixture();
  try {
    const r = land(s, envelope(['beta', 'BETA']));
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['for-each-ref', 'refs/broker/undone'], s.root), '');
  } finally { s.done(); }
});

function detachedWithOwnCommits(shape) {
  const t = setup();
  const [, subLane] = laneConfigs(t.cfg);
  if (shape === 'ahead') g(['checkout', '-q', '--detach', 'main'], t.sub);
  else {
    const old = g(['rev-parse', 'HEAD'], t.sub);
    commitOnMain(t.sub, 'moved.txt', 'm\n', 'main moved');
    g(['push', 'origin', 'main'], t.sub);
    g(['checkout', '-q', '--detach', old], t.sub);
  }
  commitOnMain(t.sub, 'own.txt', 'own\n', 'work only on the detached HEAD');
  return { t, subLane, mine: g(['rev-parse', 'HEAD'], t.sub), main: g(['rev-parse', 'main'], t.sub) };
}

for (const shape of ['ahead', 'diverged']) {
  test(`a lane tree detached at commits on no branch (${shape} of main) pauses naming the sha and is never switched to the branch`, () => {
    const { t, subLane, mine, main } = detachedWithOwnCommits(shape);
    try {
      const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n');
      writeJob(subLane, { ...job, commands: [PASS] });
      const sum = processOnce(subLane);
      assert.equal(sum.paused, true);
      const r = readResult(subLane, job.id);
      assert.equal(r.status, 'dirty', JSON.stringify(r));
      assert.ok(r.dirtyEntries.some((e) => e.includes(mine)), `names ${mine}: ${r.dirtyEntries.join(' | ')}`);
      assert.equal(g(['rev-parse', 'HEAD'], t.sub), mine, 'HEAD did not move');
      assert.throws(() => g(['symbolic-ref', '-q', 'HEAD'], t.sub), 'still detached');
      assert.equal(g(['rev-parse', 'main'], t.sub), main, 'main did not move');
    } finally { t.done(); }
  });
}

test('control: a lane tree detached at an ancestor of main is not paused by the orphan check', () => {
  const t = setup();
  const [, subLane] = laneConfigs(t.cfg);
  try {
    const old = g(['rev-parse', 'HEAD'], t.sub);
    commitOnMain(t.sub, 'newer.txt', 'n\n', 'main moved');
    g(['push', 'origin', 'main'], t.sub);
    g(['checkout', '-q', '--detach', old], t.sub);
    const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n');
    writeJob(subLane, { ...job, commands: [PASS] });
    processOnce(subLane);
    assert.equal(readResult(subLane, job.id).status, 'landed');
  } finally { t.done(); }
});

test('a gitlink is refused for a submodule commit that exists only locally, and accepted once it is on the remote', () => {
  const t = setup();
  try {
    const sub = repoByName(t.cfg, 'rapid-game');
    const entry = (sha) => ({ ...sub, cwd: t.sub, sha });
    commitOnMain(t.sub, 'local.txt', 'unpushed\n', 'local only');
    const local = g(['rev-parse', 'HEAD'], t.sub);
    assert.match(unpushedGitlink([entry(local)]), /not on origin\/main.*only locally/);
    g(['push', 'origin', 'main'], t.sub);
    assert.equal(unpushedGitlink([entry(local)]), null);
  } finally { t.done(); }
});
