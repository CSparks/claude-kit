// supervise.test.mjs — a daemon keeps a daemon behind every other lane that holds queued jobs (KIT-T957).
// Real lane directories and lock files; the spawner is injected where the test asks which lanes get one.
// Controls: a lane with a live daemon, an empty lane, the daemon's own lane and a call inside the throttle window start none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';
import { acquireLock } from './lock.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { SUPERVISE_MS, createSupervisor, superviseLanes } from './supervise.mjs';
import { trackCargo } from './patchkit.mjs';
import { setup, PASS } from './subkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const CONTROL_WAIT_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queueIn = (t, lane, flags) => writeJob(lane, { ...buildPatchJob(t.cfg, flags, '*** write a.txt\na\n').job, commands: [PASS] });
const recorder = () => { const started = []; return { started, spawner: (root, idle, why, lane) => started.push(lane || 'root') }; };

test('a lane with queued jobs and no daemon gets a spawn; a lane with a live daemon or an empty queue gets none', () => {
  const t = setup();
  try {
    const [rootLane, subLane] = laneConfigs(t.cfg);
    queueIn(t, subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' });
    const first = recorder();
    assert.deepEqual(superviseLanes(t.cfg, t.root, { selfLane: null, spawner: first.spawner }), ['rapid-game'], 'the root daemon starts the lane daemon');
    assert.deepEqual(first.started, ['rapid-game']);

    assert.ok(acquireLock(subLane).ok);
    const live = recorder();
    assert.deepEqual(superviseLanes(t.cfg, t.root, { selfLane: null, spawner: live.spawner }), [], 'control: a live daemon holds the lane');
    assert.deepEqual(live.started, []);

    queueIn(t, rootLane, { ticket: 'T-2', title: 'game' });
    const empty = recorder();
    assert.deepEqual(superviseLanes(t.cfg, t.root, { selfLane: 'rapid-game', spawner: empty.spawner }), ['root'], 'the lane daemon starts the root daemon');
  } finally { t.done(); }
});

test('a daemon never supervises its own lane, and an empty queue starts nothing', () => {
  const t = setup();
  try {
    const [, subLane] = laneConfigs(t.cfg);
    queueIn(t, subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' });
    const own = recorder();
    assert.deepEqual(superviseLanes(t.cfg, t.root, { selfLane: 'rapid-game', spawner: own.spawner }), [], 'control: the queued lane is the caller\'s own');
    const none = recorder();
    const idle = setup();
    try { assert.deepEqual(superviseLanes(idle.cfg, idle.root, { selfLane: null, spawner: none.spawner }), [], 'control: nothing queued anywhere'); } finally { idle.done(); }
    assert.deepEqual([...own.started, ...none.started], []);
  } finally { t.done(); }
});

test('the supervisor runs once per window; the next window checks again', () => {
  const t = setup();
  try {
    const [, subLane] = laneConfigs(t.cfg);
    queueIn(t, subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' });
    const sup = createSupervisor();
    const rec = recorder();
    const at = (now) => sup.tick(t.cfg, t.root, { selfLane: null, spawner: rec.spawner, now });
    assert.deepEqual(at(1_000_000), ['rapid-game']);
    assert.deepEqual(at(1_000_000 + SUPERVISE_MS - 1), [], 'control: inside the window');
    assert.deepEqual(rec.started, ['rapid-game']);
    rmSync(brokerPaths(subLane).spawning, { force: true });
    assert.deepEqual(at(1_000_000 + SUPERVISE_MS), ['rapid-game'], 'the window passed and the earlier claim never produced a daemon');
  } finally { t.done(); }
});

// A daemon reads its lanes from the checkout's own config file, so the fixture writes the one `setup` holds in memory.
function daemonFixture() {
  const t = trackCargo(setup());
  mkdirSync(join(t.root, '.ai'), { recursive: true });
  writeFileSync(join(t.root, '.ai', 'config.yml'), [
    'broker:',
    '  repos:',
    '    - { name: super, path: ., main: main, remote: origin }',
    '    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }',
    '',
  ].join('\n'));
  return t;
}

const startRootDaemon = (t, autostart) => spawn(process.execPath, [BROKER, '--root', t.root, '--poll', '200'], { env: { ...process.env, BROKER_NO_AUTOSTART: autostart ? '' : '1', BROKER_ALLOW_NON_CARGO: '1' }, stdio: 'ignore', windowsHide: true });

test('a running daemon starts the daemon of a lane whose queue has jobs, and that daemon runs them', async () => {
  const t = daemonFixture();
  const [, subLane] = laneConfigs(t.cfg);
  const job = queueIn(t, subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' });
  const root = startRootDaemon(t, true);
  try {
    let result = null;
    for (const end = Date.now() + 120_000; Date.now() < end && !result; await sleep(250)) result = readResult(subLane, job.id);
    assert.ok(result, 'the lane had no daemon and the root daemon started one');
    assert.equal(result.status, 'passed');
  } finally {
    root.kill();
    try {
      const pid = JSON.parse(readFileSync(brokerPaths(subLane).lock, 'utf8')).pid;
      if (pid) spawnSync(process.platform === 'win32' ? 'taskkill' : 'kill', process.platform === 'win32' ? ['/PID', String(pid), '/T', '/F'] : [String(pid)], { windowsHide: true });
    } catch { /* no lane daemon was started */ }
    await sleep(500);
    t.done();
  }
});

test('control: with autostart off the same running daemon leaves the lane queue alone', async () => {
  const t = daemonFixture();
  const [, subLane] = laneConfigs(t.cfg);
  const job = queueIn(t, subLane, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' });
  const root = startRootDaemon(t, false);
  try {
    await sleep(CONTROL_WAIT_MS);
    assert.equal(readResult(subLane, job.id), null);
  } finally { root.kill(); await sleep(300); t.done(); }
});
