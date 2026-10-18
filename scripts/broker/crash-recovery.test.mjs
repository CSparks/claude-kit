// crash-recovery.test.mjs — what a replacement daemon does after the first one was killed hard
// (KIT-T549): it ends the command tree the dead daemon left running and keeps that run's log (a,b),
// and a queue with no daemon behind it gets one from `status` and submit without a wait polling (c).
// Controls: a finished command, a live daemon's command and another host's record are not touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';
import { reapOrphans } from './children.mjs';
import { ensureQueuedLanes } from './ensure.mjs';
import { acquireLock } from './lock.mjs';
import { ensureDirs, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, trackCargo } from './patchkit.mjs';
import { setup, PASS } from './subkit.mjs';
import { tempDir } from './testkit.mjs';

const DRIVE = join(import.meta.dirname, 'orphan-drive.mjs');
const BROKER = join(import.meta.dirname, 'broker.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

async function until(check, ms = 180_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = check(); if (v) return v; await sleep(150); }
  return null;
}

test('the replacement daemon ends the cargo tree a killed daemon left running and keeps that run\'s log', async () => {
  const s = fixture();
  let pid = 0;
  try {
    const home = ensureDirs(s.cfg).home;
    const registry = join(home, 'children.json');
    const log = join(brokerPaths(s.cfg).logs, 'j-dead-0.log');
    const dead = spawn(process.execPath, [DRIVE, home, log], { stdio: 'ignore', windowsHide: true });
    const rec = await until(() => { try { return JSON.parse(readFileSync(registry, 'utf8'))[0]; } catch { return null; } });
    assert.ok(rec, 'the daemon recorded its command');
    pid = rec.pid;
    await until(() => existsSync(log) && readFileSync(log, 'utf8').includes('started'));
    dead.kill('SIGKILL');
    await until(() => !alive(dead.pid));
    assert.ok(alive(pid), 'the command outlived its daemon (the failure this guards against)');

    const r = spawnSync(process.execPath, [BROKER, '--root', s.root, '--once'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(await until(() => !alive(pid), 15_000), 'the replacement ended the command tree');
    assert.match(r.stderr, /ended .*left running by the daemon that died/);
    const kept = join(brokerPaths(s.cfg).logs, 'j-dead-0.interrupted.log');
    assert.match(readFileSync(kept, 'utf8'), /started/, 'the killed run\'s log is kept');
    assert.match(readFileSync(log, 'utf8'), /started/, 'the original stays for the resume to read until the re-run overwrites it');
    assert.ok(!existsSync(registry), 'the record is cleared');
  } finally {
    if (pid && alive(pid)) { try { process.kill(pid); } catch { /* gone */ } }
    s.done();
  }
});

test('control: a finished command, a live daemon\'s command and another host\'s record are left alone', () => {
  const dir = tempDir('children-');
  const registry = join(dir, 'children.json');
  const logOf = (n) => { const p = join(dir, `${n}.log`); writeFileSync(p, `${n}\n`); return p; };
  const done = join(dir, 'done.exit');
  writeFileSync(done, '0');
  writeFileSync(registry, JSON.stringify([
    { pid: 999999, daemon: 999998, host: hostname(), marker: done, logPath: logOf('finished'), cmd: 'finished' },
    { pid: process.pid, daemon: process.pid, host: hostname(), marker: join(dir, 'none.exit'), logPath: logOf('live'), cmd: 'live' },
    { pid: 999997, daemon: 999996, host: 'another-host', marker: join(dir, 'none.exit'), logPath: logOf('foreign'), cmd: 'foreign' },
  ]));
  assert.deepEqual(reapOrphans(registry), []);
  assert.ok(existsSync(join(dir, 'live.log')) && existsSync(join(dir, 'foreign.log')), 'their logs are untouched');
  assert.equal(JSON.parse(readFileSync(registry, 'utf8')).length, 2, 'the finished one is dropped, the other two are kept');
  assert.ok(!existsSync(join(dir, 'finished.interrupted.log')), 'a finished command\'s log is not kept as interrupted');
});

test('a second interruption of one log keeps both', () => {
  const dir = tempDir('children-');
  const registry = join(dir, 'children.json');
  const log = join(dir, 'j-1-0.log');
  for (const n of [1, 2]) {
    writeFileSync(log, `run ${n}\n`);
    writeFileSync(registry, JSON.stringify([{ pid: 999999, daemon: 999998, host: hostname(), marker: join(dir, 'none.exit'), logPath: log, cmd: 'x' }]));
    reapOrphans(registry);
  }
  assert.equal(readFileSync(join(dir, 'j-1-0.interrupted.log'), 'utf8'), 'run 1\n');
  assert.equal(readFileSync(join(dir, 'j-1-0.interrupted-2.log'), 'utf8'), 'run 2\n');
});

test('a queue with no daemon gets one in every lane that holds jobs; a lane with a live daemon or an empty queue gets none', () => {
  const t = setup();
  try {
    const [rootLane, subLane] = laneConfigs(t.cfg);
    const queue = (cfg, flags) => writeJob(cfg, { ...buildPatchJob(t.cfg, flags, '*** write a.txt\na\n').job, commands: [PASS] });
    queue(rootLane, { ticket: 'T-1', title: 'game' });
    queue(subLane, { repo: 'rapid-game', ticket: 'T-2', title: 'fw' });
    const started = [];
    assert.deepEqual(ensureQueuedLanes(t.cfg, t.root, (root, idle, why, lane) => started.push(lane || 'root')), ['root', 'rapid-game']);
    assert.deepEqual(started, ['root', 'rapid-game']);
    assert.ok(acquireLock(rootLane).ok);
    const again = [];
    assert.deepEqual(ensureQueuedLanes(t.cfg, t.root, (root, idle, why, lane) => again.push(lane || 'root')), [], 'a live daemon in one lane and a start already claimed in the other');
    assert.deepEqual(again, []);
  } finally { t.done(); }
});

test('`broker status` starts a daemon behind a queued job that nothing waits on; BROKER_NO_AUTOSTART opts out', async () => {
  const s = trackCargo(fixture());
  try {
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta' }, envelope(['beta', 'BETA']));
    writeJob(s.cfg, { ...job, commands: ['node -e "0"'] });
    const off = spawnSync(process.execPath, [BROKER, 'status', '--root', s.root], { encoding: 'utf8', windowsHide: true, env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.equal(off.status, 0, off.stderr);
    assert.doesNotMatch(off.stderr, /started one/);
    assert.equal(readResult(s.cfg, job.id), null, 'control: with the opt-out nothing runs the job');

    const on = spawnSync(process.execPath, [BROKER, 'status', '--root', s.root], { encoding: 'utf8', windowsHide: true, env: { ...process.env, BROKER_NO_AUTOSTART: '' } });
    assert.match(on.stderr, /no daemon was behind the root queue; started one/);
    const r = await until(() => readResult(s.cfg, job.id), 120_000);
    assert.equal(r && r.status, 'passed', 'the daemon status started ran the job');
  } finally { s.done(); }
});
