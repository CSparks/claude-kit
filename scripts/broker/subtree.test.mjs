// subtree.test.mjs — the submodule's working tree has one owner at a time (KIT-T517, KIT-T549 d):
// a superproject job that pins or builds the submodule never starts while the submodule lane has
// a job in flight, and the lane yields to it in turn; a pin checkout never leaves the submodule
// detached, even when the daemon died mid-run. The two lanes run as separate processes here
// (subtree-drive.mjs), the way their daemons do. Controls: a superproject job that does not touch
// the tree runs beside a lane job; a live holder and uncommitted work are left alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { laneConfigs, repoByName } from './config.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';
import { reclaimStale, reconcileSubtrees, takeSubtrees } from './subtree.mjs';
import { tempDir } from './testkit.mjs';

const DRIVE = join(import.meta.dirname, 'subtree-drive.mjs').replace(/\\/g, '/');
const SUB_HEAD = 'git -C rapid-game rev-parse HEAD';
const LOCK = (t) => join(t.cfg.targetDir, 'broker', 'subtree', 'rapid-game.lock');

function fixture() {
  const t = setup();
  const cfgFile = join(tempDir('subtree-cfg-'), 'cfg.json');
  writeFileSync(cfgFile, JSON.stringify({ root: t.root, broker: t.broker }));
  const [rootLane, subLane] = laneConfigs(t.cfg);
  const drive = (lane, ...flags) => `node "${DRIVE}" lane ${lane} "${cfgFile.replace(/\\/g, '/')}" ${flags.join(' ')}`;
  const queue = (cfg, flags, env, commands) => {
    const { job, error } = buildPatchJob(t.cfg, flags, env);
    assert.ok(job, error);
    return writeJob(cfg, { ...job, commands });
  };
  return { ...t, cfgFile, rootLane, subLane, drive, queue };
}

const logOf = (r) => r.commands[0].logTail.join('\n');

test('a superproject job that pins the submodule does not start while the submodule lane has a job running', () => {
  const t = fixture();
  try {
    const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    const laneJob = t.queue(t.subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' }, '*** write api.txt\napi\n', [t.drive('root', '--commit')]);
    const rootJob = t.queue(t.rootLane, { pin: `rapid-game=${pinned}` }, '*** write game.txt\ngame\n', [SUB_HEAD]);
    processOnce(t.subLane);
    const lane = readResult(t.subLane, laneJob.id);
    assert.equal(lane.status, 'passed', JSON.stringify(lane));
    assert.match(logOf(lane), /processed=0 queued=1/, 'the root lane started nothing while the submodule lane held its tree');
    assert.equal(readResult(t.rootLane, rootJob.id), null);
    assert.equal(listQueue(t.rootLane).length, 1, 'the job stays queued');

    processOnce(t.rootLane);
    const r = readResult(t.rootLane, rootJob.id);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.match(logOf(r), new RegExp(pinned), 'then it builds the submodule at its pinned sha');
    assert.equal(g(['symbolic-ref', '--short', 'HEAD'], t.sub), 'main');
  } finally { t.done(); }
});

test('the submodule lane does not start while a superproject job holds the tree, then runs', () => {
  const t = fixture();
  try {
    const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    const laneJob = t.queue(t.subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' }, '*** write api.txt\napi\n', [PASS]);
    const rootJob = t.queue(t.rootLane, { pin: `rapid-game=${pinned}` }, '*** write game.txt\ngame\n', [t.drive('rapid-game')]);
    processOnce(t.rootLane);
    const root = readResult(t.rootLane, rootJob.id);
    assert.equal(root.status, 'passed', JSON.stringify(root));
    assert.match(logOf(root), /processed=0 queued=1/, 'the lane started nothing while the superproject held the tree');
    assert.equal(readResult(t.subLane, laneJob.id), null);

    processOnce(t.subLane);
    assert.equal(readResult(t.subLane, laneJob.id).status, 'passed');
  } finally { t.done(); }
});

test('control: a superproject job that neither pins nor builds the submodule runs beside a lane job', () => {
  const t = fixture();
  try {
    t.queue(t.subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' }, '*** write api.txt\napi\n', [t.drive('root')]);
    const rootJob = t.queue(t.rootLane, {}, '*** write game.txt\ngame\n', [PASS]);
    processOnce(t.subLane);
    assert.equal(readResult(t.rootLane, rootJob.id).status, 'passed');
  } finally { t.done(); }
});

test('the lane that found the tree held is served first; a want nobody refreshed expires', () => {
  const t = fixture();
  try {
    const sub = repoByName(t.cfg, 'rapid-game');
    const lane = takeSubtrees(t.subLane, [sub], 'j-lane');
    assert.ok(lane.ok);
    const blocked = takeSubtrees(t.rootLane, [sub], 'j-root');
    assert.equal(blocked.ok, false);
    assert.match(blocked.reason, /held by lane rapid-game .j-lane/);
    lane.release();

    const again = takeSubtrees(t.subLane, [sub], 'j-lane-2');
    assert.equal(again.ok, false, 'the lane that just released does not retake the tree ahead of the waiter');
    assert.match(again.reason, /yielding to lane root/);
    const expired = takeSubtrees(t.subLane, [sub], 'j-lane-2', { now: () => Date.now() + 60_000 });
    assert.ok(expired.ok, 'a want nobody refreshed has expired');
    expired.release();

    const root = takeSubtrees(t.rootLane, [sub], 'j-root');
    assert.ok(root.ok, 'the waiter takes it once the holder is gone');
    root.release();
    const last = takeSubtrees(t.subLane, [sub], 'j-lane-3');
    assert.ok(last.ok, 'the want is gone once served');
    assert.equal(takeSubtrees(t.subLane, [sub], 'j-lane-4').ok, false, 'a held tree is refused');
    last.release();
  } finally { t.done(); }
});

test('idle work claims no priority: a lane that yields only to a real job', () => {
  const t = fixture();
  try {
    const sub = repoByName(t.cfg, 'rapid-game');
    const lane = takeSubtrees(t.subLane, [sub], 'j-lane');
    const idle = takeSubtrees(t.rootLane, [sub], 'suite-x', { idle: true });
    assert.equal(idle.ok, false);
    lane.release();
    const next = takeSubtrees(t.subLane, [sub], 'j-lane-2');
    assert.ok(next.ok, 'the idle waiter left no want behind');
    next.release();
  } finally { t.done(); }
});

// A daemon that took the tree, detached it at a pin and died without releasing.
function killedMidPin(t, sha) {
  const r = spawnSync(process.execPath, [DRIVE.replace(/\//g, '\\'), 'crash', t.cfgFile, sha], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(g(['rev-parse', '--abbrev-ref', 'HEAD'], t.sub), 'HEAD', 'the killed run left the submodule detached');
}

test('after a hard kill mid-pin, the replacement daemon puts the submodule back on its branch before it runs anything', () => {
  const t = fixture();
  try {
    const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    killedMidPin(t, pinned);
    const reclaimed = reconcileSubtrees(t.rootLane);
    assert.equal(reclaimed.length, 1);
    assert.equal(g(['symbolic-ref', '--short', 'HEAD'], t.sub), 'main');
  } finally { t.done(); }
});

test('a pin job re-run after the daemon died mid-pin leaves the submodule on its branch, not detached at the pin', () => {
  const t = fixture();
  try {
    const fw = t.run({ repo: 'rapid-game', ticket: 'ST-T1', title: 'framework half', land: true, 'no-pin': true }, '*** write api.txt\nnew api\n').r.landed.sha;
    const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    assert.notEqual(pinned, fw);
    killedMidPin(t, pinned);
    const { r } = t.run({ pin: `rapid-game=${pinned}` }, '*** write game.txt\ngame\n', [SUB_HEAD]);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.match(logOf(r), new RegExp(pinned));
    assert.equal(g(['symbolic-ref', '--short', 'HEAD'], t.sub), 'main', 'back on its branch');
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), fw, 'at the lane tip it had before the job');
  } finally { t.done(); }
});

test('negative: a live holder keeps its lock, and a stale superproject lock never discards uncommitted work', () => {
  const t = fixture();
  try {
    const sub = repoByName(t.cfg, 'rapid-game');
    const held = takeSubtrees(t.subLane, [sub], 'j-lane');
    assert.deepEqual(reconcileSubtrees(t.rootLane), [], 'a live holder is not reclaimed');
    assert.ok(reclaimStale(t.rootLane, sub).held);
    held.release();

    const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    killedMidPin(t, pinned);
    writeFileSync(join(t.sub, 'README'), 'hand edit\n');
    reconcileSubtrees(t.rootLane);
    assert.equal(g(['rev-parse', '--abbrev-ref', 'HEAD'], t.sub), 'HEAD', 'left detached rather than check out over the edit');
    assert.equal(g(['status', '--porcelain'], t.sub), 'M README');
  } finally { t.done(); }
});
