// stop.test.mjs — `broker.mjs --help` and unknown arguments print usage without starting a daemon,
// and `stop` ends a live daemon gracefully, refusing while jobs are queued unless --now (KIT-T501).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { acquireLock, liveHolder, releaseLock } from './lock.mjs';
import { stopRequested } from './control.mjs';
import { writeJob } from './result.mjs';
import { stopDaemon } from './stop.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const run = (root, ...args) => spawnSync(process.execPath, [BROKER, '--root', root, ...args], { encoding: 'utf8', timeout: 20000 });

test('--help and unknown arguments print usage and start nothing; a known command still runs (control)', () => {
  const s = fixture();
  try {
    const help = run(s.root, '--help');
    assert.equal(help.status, 0);
    assert.match(help.stdout, /usage: broker\.mjs/);
    assert.ok(!existsSync(join(s.root, 'target', 'broker', 'broker.lock')), 'no daemon lock');
    for (const bad of [['--bogus'], ['frobnicate'], ['-h']]) {
      const r = run(s.root, ...bad);
      assert.equal(r.status, 2, bad.join(' '));
      assert.match(r.stderr, /usage: broker\.mjs/);
    }
    assert.ok(!existsSync(join(s.root, 'target', 'broker', 'broker.lock')));
    assert.equal(run(s.root, 'status').status, 0, 'control');
  } finally { s.done(); }
});

test('stop: no daemon is a no-op; a queued job refuses without --now; --now and an idle daemon request the stop', () => {
  const s = fixture();
  try {
    assert.match(stopDaemon(s.cfg).text, /no daemon/);
    assert.ok(acquireLock(s.cfg).ok);
    assert.ok(liveHolder(s.cfg));
    assert.equal(stopDaemon(s.cfg).code, 0);
    assert.ok(stopRequested(s.cfg), 'idle daemon: stop requested');
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    const marker = join(s.cfg.targetDir, 'broker', 'stop');
    spawnSync(process.execPath, ['-e', `require('fs').rmSync(${JSON.stringify(marker)},{force:true})`]);
    assert.equal(stopDaemon(s.cfg).code, 1, 'refuses mid-job');
    assert.ok(!stopRequested(s.cfg), 'refusal writes nothing');
    assert.equal(stopDaemon(s.cfg, { now: true }).code, 0);
    assert.ok(stopRequested(s.cfg));
    releaseLock(s.cfg);
  } finally { s.done(); }
});

test('a running daemon exits on its own after `stop`', async () => {
  const s = fixture();
  try {
    const child = spawn(process.execPath, [BROKER, '--root', s.root, '--poll', '100'], { stdio: 'ignore' });
    const exited = new Promise((r) => child.on('exit', r));
    for (let i = 0; i < 100 && !liveHolder(s.cfg); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(liveHolder(s.cfg), 'daemon came up');
    assert.equal(run(s.root, 'stop').status, 0);
    assert.equal(await Promise.race([exited, new Promise((r) => setTimeout(() => r('timeout'), 15000))]), 0);
    assert.equal(liveHolder(s.cfg), null);
  } finally { s.done(); }
});

test('stop clears the stale lock of a dead pid; a live holder keeps its lock (control)', () => {
  const s = fixture();
  try {
    const lock = join(s.root, 'target', 'broker', 'broker.lock');
    assert.ok(acquireLock(s.cfg).ok);
    assert.doesNotMatch(stopDaemon(s.cfg).text, /stale/);
    assert.ok(existsSync(lock), 'live holder keeps its lock');
    releaseLock(s.cfg);
    writeFileSync(lock, JSON.stringify({ pid: 2147483646, host: hostname(), ts: '' }));
    assert.match(stopDaemon(s.cfg).text, /cleared the stale lock of dead pid 2147483646/);
    assert.ok(!existsSync(lock));
  } finally { s.done(); }
});
