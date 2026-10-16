// reattach.test.mjs — the submodule lane puts its own tree back on the branch before a job (KIT-T517):
// a clean checkout detached at an ancestor of main (a leftover pin checkout) is fast-forwarded onto
// main, so the patch applies to the branch tip and the landing can attach. Controls: a dirty tree, a
// HEAD ahead of or diverged from main, and a tree already on main are left as found.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { laneConfigs, repoByName } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { takeSubtrees } from './subtree.mjs';

const HEAD = 'git rev-parse HEAD';

// rapid-game with main one commit ahead of the sha the superproject records, detached at that older sha.
function detachedBehind() {
  const t = setup();
  const [rootLane, subLane] = laneConfigs(t.cfg);
  const old = g(['rev-parse', 'HEAD'], t.sub);
  commitOnMain(t.sub, 'newer.txt', 'newer\n', 'main moved on');
  const tip = g(['rev-parse', 'HEAD'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  g(['checkout', '-q', '--detach', old], t.sub);
  return { ...t, rootLane, subLane, old, tip, sub: repoByName(t.cfg, 'rapid-game') };
}

const head = (t) => g(['rev-parse', 'HEAD'], t.root + '/rapid-game');
const onBranch = (t) => { try { return g(['symbolic-ref', '--short', 'HEAD'], join(t.root, 'rapid-game')); } catch { return null; } };

test('a lane job on a tree detached at an ancestor of main runs on main\'s tip and lands, and says it reattached', () => {
  const t = detachedBehind();
  const lines = [];
  const was = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n');
    writeJob(t.subLane, { ...job, commands: [HEAD] });
    processOnce(t.subLane);
    const r = readResult(t.subLane, job.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(r.commands[0].logTail.join('\n').includes(t.tip), true, 'the command ran on main\'s tip, not the stale base');
    assert.equal(onBranch(t), 'main');
    assert.equal(g(['rev-parse', 'HEAD~1'], join(t.root, 'rapid-game')), t.tip, 'the landing sits on the tip');
  } finally { console.error = was; t.done(); }
  assert.ok(lines.some((l) => /rapid-game was detached at .*back on main before/.test(l)), lines.join('\n'));
});

test('control: a dirty tree is left detached and untouched', () => {
  const t = detachedBehind();
  try {
    writeFileSync(join(t.root, 'rapid-game', 'README'), 'hand edit\n');
    const got = takeSubtrees(t.subLane, [t.sub], 'j-1');
    assert.ok(got.ok);
    assert.equal(head(t), t.old);
    assert.equal(onBranch(t), null);
    assert.equal(g(['status', '--porcelain'], join(t.root, 'rapid-game')), 'M README');
    got.release();
  } finally { t.done(); }
});

test('control: a detached HEAD ahead of main, or diverged from it, is left alone', () => {
  for (const shape of ['ahead', 'diverged']) {
    const t = detachedBehind();
    try {
      if (shape === 'ahead') g(['checkout', '-q', '--detach', 'main'], join(t.root, 'rapid-game'));
      commitOnMain(join(t.root, 'rapid-game'), 'own.txt', 'own\n', 'detached work');
      const mine = head(t);
      const got = takeSubtrees(t.subLane, [t.sub], 'j-1');
      assert.ok(got.ok, shape);
      assert.equal(head(t), mine, shape);
      assert.equal(onBranch(t), null, shape);
      got.release();
    } finally { t.done(); }
  }
});

test('control: a tree already on main is a no-op, and a superproject job does not reattach', () => {
  const t = detachedBehind();
  const lines = [];
  const was = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    const sub = join(t.root, 'rapid-game');
    const root = takeSubtrees(t.rootLane, [t.sub], 'j-root');
    assert.ok(root.ok);
    assert.equal(head(t), t.old, 'only the submodule\'s own lane reattaches');
    root.release();
    g(['checkout', '-q', 'main'], sub);
    const got = takeSubtrees(t.subLane, [t.sub], 'j-1');
    assert.ok(got.ok);
    assert.equal(head(t), t.tip);
    assert.equal(onBranch(t), 'main');
    got.release();
  } finally { console.error = was; t.done(); }
  assert.deepEqual(lines.filter((l) => /back on main/.test(l)), []);
});
