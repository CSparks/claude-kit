// live-trees.test.mjs — a landing takes the submodule tree only for the landing step (KIT-T1046). With the check tree a job
// builds and tests in the broker's own copy, so another lane of the checkout lands while it builds; two landings never
// overlap in the tree; a holder that died is reclaimed (KIT-T552); a landing that finds the tree held past its bounded wait
// stays queued with its check done, never failed. Controls: a pin job still holds the tree for its whole run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { laneConfigs, repoByName } from './config.mjs';
import { LAND_WAIT_MS, TreeBusy, beginJob, endJob, holdLive, setLandWait } from './live-trees.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';
import { liveSubtreesFor, subtreesFor, takeSubtrees } from './subtree.mjs';
import { tempDir } from './testkit.mjs';

const DRIVE = join(import.meta.dirname, 'subtree-drive.mjs').replace(/\\/g, '/');
const WAIT_MS = 150;
const POLL_MS = 10;

function fixture() {
  const t = setup();
  t.cfg.checkTree = true;
  const cfgFile = join(tempDir('live-trees-cfg-'), 'cfg.json');
  writeFileSync(cfgFile, JSON.stringify({ root: t.root, broker: { ...t.broker, check_tree: true } }));
  const [rootLane, subLane] = laneConfigs(t.cfg);
  const drive = (lane) => `node "${DRIVE}" lane ${lane} "${cfgFile.replace(/\\/g, '/')}"`;
  const queue = (cfg, flags, env, commands) => {
    const { job, error } = buildPatchJob(t.cfg, flags, env);
    assert.ok(job, error);
    return writeJob(cfg, { ...job, commands });
  };
  const sub = repoByName(t.cfg, 'rapid-game');
  return { ...t, rootLane, subLane, drive, queue, sub };
}

const logOf = (r) => r.commands.map((c) => c.logTail.join('\n')).join('\n');
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

test('a landing builds without the tree: the other lane lands while it runs, then it lands too', () => {
  const t = fixture();
  try {
    const laneJob = t.queue(t.subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n', [PASS]);
    const rootJob = t.queue(t.rootLane, { ticket: 'T-2', title: 'game', land: true }, '*** write game.txt\ngame\n', [`${t.drive('rapid-game')} cargo`]);
    processOnce(t.rootLane);
    const root = readResult(t.rootLane, rootJob.id);
    assert.equal(root.status, 'landed', JSON.stringify(root));
    const lane = readResult(t.subLane, laneJob.id);
    assert.ok(lane && lane.status === 'landed', 'the submodule lane landed its job while the root lane was building, before the root landing');
    assert.ok(lane.finishedAt <= root.finishedAt);
    assert.equal(existsSync(join(t.root, 'rapid-game', 'api.txt')), true);
  } finally { t.done(); }
});

test('control: a pin job still holds the tree for its whole run', () => {
  const t = fixture();
  try {
    const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    const laneJob = t.queue(t.subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true }, '*** write api.txt\napi\n', [PASS]);
    const rootJob = t.queue(t.rootLane, { pin: `rapid-game=${pinned}` }, '*** write game.txt\ngame\n', [t.drive('rapid-game')]);
    process.env.BROKER_LAND_WAIT_MS = String(WAIT_MS);
    processOnce(t.rootLane);
    delete process.env.BROKER_LAND_WAIT_MS;
    assert.match(logOf(readResult(t.rootLane, rootJob.id)), /processed=0 queued=1/, 'the submodule lane could not land while the pin job held the tree');
    assert.equal(readResult(t.subLane, laneJob.id), null);
    assert.deepEqual(subtreesFor(t.rootLane, t.rootLane.repos[0], [{ pins: [{ repo: 'rapid-game' }] }]).map((s) => s.name), ['rapid-game']);
  } finally { t.done(); }
});

test('with the check tree a landing takes no tree up front; the landing step takes the trees the job may write', () => {
  const t = fixture();
  try {
    const landing = { land: true, commands: ['cargo test'], ops: [] };
    assert.deepEqual(subtreesFor(t.rootLane, t.rootLane.repos[0], [landing]), []);
    assert.deepEqual(liveSubtreesFor(t.rootLane, t.rootLane.repos[0], [landing]).map((s) => s.name), ['rapid-game']);
    assert.deepEqual(subtreesFor(t.subLane, t.sub, [landing]), [], 'the submodule lane does not hold its own tree for a landing either');
  } finally { t.done(); }
});

test('two landings never overlap in the tree: the second waits for the first to hand over', () => {
  const t = fixture();
  try {
    beginJob(t.rootLane, [t.sub], 'j-first');
    assert.equal(holdLive(), true);
    assert.equal(holdLive(), false, 'a second hold in the same job takes nothing more');
    const other = takeSubtrees(t.subLane, [t.sub], 'j-second');
    assert.equal(other.ok, false, 'the other lane cannot land while the first landing holds the tree');
    assert.match(other.reason, /held by lane root/);
    endJob();
    const after = takeSubtrees(t.subLane, [t.sub], 'j-second');
    assert.ok(after.ok, 'handed over when the landing ended');
    after.release();
  } finally { endJob(); t.done(); }
});

test('a landing that finds the tree held past its wait stays queued with no failure, then lands once it is free', () => {
  const t = fixture();
  setLandWait(WAIT_MS, POLL_MS);
  try {
    const held = takeSubtrees(t.subLane, [t.sub], 'j-lane');
    assert.ok(held.ok);
    const rootJob = t.queue(t.rootLane, { ticket: 'T-3', title: 'game', land: true }, '*** write game.txt\ngame\n', [`${PASS} cargo`]);
    const first = processOnce(t.rootLane);
    assert.equal(readResult(t.rootLane, rootJob.id), null, 'no result: the job was not failed');
    assert.equal(listQueue(t.rootLane).length, 1, 'still queued');
    assert.match(first.waiting.join(';'), /held by lane rapid-game/);
    held.release();
    processOnce(t.rootLane);
    assert.equal(readResult(t.rootLane, rootJob.id).status, 'landed');
  } finally { setLandWait(LAND_WAIT_MS); t.done(); }
});

test('a holder that died is reclaimed by the landing step (KIT-T552)', () => {
  const t = fixture();
  try {
    const lock = join(t.rootLane.targetDir, 'broker', 'subtree', 'rapid-game.lock');
    const taken = takeSubtrees(t.subLane, [t.sub], 'j-dead');
    assert.ok(taken.ok);
    writeFileSync(lock, JSON.stringify({ lane: 'rapid-game', id: 'j-dead', pid: deadPid(), host: hostname(), token: 'x', restore: false }));
    beginJob(t.rootLane, [t.sub], 'j-live');
    assert.equal(holdLive(), true, 'the dead holder is gone');
    endJob();
  } finally { endJob(); t.done(); }
});

test('holdLive throws TreeBusy when the wait ends', () => {
  const t = fixture();
  try {
    const held = takeSubtrees(t.subLane, [t.sub], 'j-lane');
    beginJob(t.rootLane, [t.sub], 'j-root');
    assert.throws(() => holdLive({ waitMs: WAIT_MS, pollMs: POLL_MS }), TreeBusy);
    held.release();
  } finally { endJob(); t.done(); }
});
