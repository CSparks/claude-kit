// lanes.test.mjs — one queue per repo (KIT-D096): a submodule's jobs live in their own lane, neither
// lane's daemon touches the other's jobs, a submodule lane lands without repinning the
// superproject, a job written into the wrong lane is handed over, and two checkouts landing the
// same remote serialize through one push lock. Controls: the root lane still lands its own jobs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs, laneOfRepo, withLane } from './config.mjs';
import { laneCfgFor } from './lanes.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { rerouteMisplaced } from './reroute.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { withPushLock } from './pushlock.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const queueIn = (cfg, flags, envelope) => {
  const { job } = buildPatchJob(cfg, flags, envelope);
  return writeJob(withLane(cfg, laneOfRepo(cfg, job.repo)), { ...job, commands: [PASS] });
};

test('each repo has its own queue dir: submodule jobs never appear in the root lane', () => {
  const t = setup();
  try {
    const sub = queueIn(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n');
    const root = queueIn(t.cfg, { ticket: 'T-2', title: 'game', land: true }, '*** write game.txt\ngame\n');
    const [rootLane, subLane] = laneConfigs(t.cfg);
    assert.notEqual(brokerPaths(rootLane).queue, brokerPaths(subLane).queue);
    assert.deepEqual(listQueue(rootLane).map((j) => j.id), [root.id]);
    assert.deepEqual(listQueue(subLane).map((j) => j.id), [sub.id]);
    assert.equal(laneCfgFor(t.cfg, sub.id).lane, 'rapid-game');
    assert.equal(laneCfgFor(t.cfg, root.id).lane, null);
  } finally { t.done(); }
});

test('the root daemon leaves a submodule job queued; the submodule lane lands it and does not repin the superproject', () => {
  const t = setup();
  try {
    const sub = queueIn(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n');
    const superHead = g(['rev-parse', 'HEAD'], t.root);
    const [rootLane, subLane] = laneConfigs(t.cfg);
    processOnce(rootLane);
    assert.equal(readResult(subLane, sub.id), null, 'the root lane does not run it');
    assert.equal(listQueue(subLane).length, 1);
    processOnce(subLane);
    const r = readResult(subLane, sub.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(r.landed.superSha, null, 'a submodule lane never writes the superproject');
    assert.equal(g(['rev-parse', 'HEAD'], t.root), superHead);
    assert.equal(g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root), r.landed.sha, 'the submodule commit is pushed');
  } finally { t.done(); }
});

test('control: the root lane lands its own job, and a root job queued beside a submodule job is not held by it', () => {
  const t = setup();
  try {
    queueIn(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n');
    const root = queueIn(t.cfg, { ticket: 'T-2', title: 'game', land: true }, '*** write game.txt\ngame\n');
    const [rootLane, subLane] = laneConfigs(t.cfg);
    processOnce(rootLane);
    assert.equal(readResult(rootLane, root.id).status, 'landed');
    assert.equal(listQueue(subLane).length, 1, 'the submodule job still waits for its own daemon');
  } finally { t.done(); }
});

test('a job in the wrong lane is handed to its repo lane; one already in place stays (control)', () => {
  const t = setup();
  try {
    const [rootLane, subLane] = laneConfigs(t.cfg);
    const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' }, '*** write api.txt\napi\n');
    writeJob(rootLane, { ...job, commands: [PASS] });
    const home = queueIn(t.cfg, { ticket: 'T-2', title: 'game' }, '*** write game.txt\ngame\n');
    assert.deepEqual(rerouteMisplaced(rootLane), [job.id]);
    assert.deepEqual(listQueue(subLane).map((j) => j.id), [job.id]);
    assert.deepEqual(listQueue(rootLane).map((j) => j.id), [home.id]);
    assert.ok(!existsSync(join(brokerPaths(rootLane).queue, `${job.id}.json`)));
  } finally { t.done(); }
});

test('two landings on one remote serialize through the push lock; another remote and a later landing are free (control)', () => {
  const dir = tempDir('pushlock-');
  try {
    const order = [];
    withPushLock('git://x/rapid-game', () => {
      order.push('outer');
      assert.throws(() => withPushLock('git://x/rapid-game', () => order.push('inner'), { dir, timeoutMs: 300, pollMs: 50 }), /push lock .* held by pid/);
    }, { dir });
    assert.deepEqual(order, ['outer'], 'the second landing could not enter while the first held the lock');
    withPushLock('git://x/other', () => order.push('other remote'), { dir });
    withPushLock('git://x/rapid-game', () => order.push('after'), { dir });
    assert.deepEqual(order, ['outer', 'other remote', 'after']);
  } finally { cleanup(dir); }
});
