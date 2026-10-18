// launch.test.mjs — a daemon started for a worker belongs to no worker shell and logs to
// target/broker/logs (KIT-T496).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { launchDaemon, wmiCommand } from './launch.mjs';
import { fixture, trackCargo } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('on Windows the daemon is created through Win32_Process.Create, hidden, with --log auto', () => {
  const calls = [];
  const r = launchDaemon(BROKER, 'D:/x y/repo', ['--idle-exit', '60'], { platform: 'win32', run: (file, argv) => { calls.push([file, argv]); return { status: 0, stdout: '4242\n' }; } });
  assert.deepEqual(r, { ok: true, how: 'wmi', pid: 4242 });
  const script = calls[0][1].at(-1);
  assert.equal(calls[0][0], 'powershell.exe');
  assert.match(script, /Invoke-CimMethod -ClassName Win32_Process -MethodName Create/);
  assert.match(script, /ShowWindow = \[uint16\]0/);
  assert.match(script, /"--root" "D:\/x y\/repo" "--idle-exit" "60" "--log" "auto"/);
  assert.match(wmiCommand("it's", 'C:/a'), /CommandLine = 'it''s'/, 'single quotes are escaped for PowerShell');
});

test('negative: a failed Create is reported, never silent', () => {
  const r = launchDaemon(BROKER, 'D:/repo', [], { platform: 'win32', run: () => ({ status: 9, stderr: 'access denied' }) });
  assert.equal(r.ok, false);
  assert.match(r.error, /exit 9\): access denied/);
});

test('live: the launched daemon is not our child and writes its own log', { skip: process.platform !== 'win32' }, async () => {
  const s = trackCargo(fixture());
  try {
    const r = launchDaemon(BROKER, s.root, ['--idle-exit', '0.05', '--poll', '200', '--spawned-by', 'launch.test: live']);
    assert.ok(r.ok, r.error);
    const logs = brokerPaths(s.cfg).logs;
    const end = Date.now() + 180_000;
    let log = null;
    while (!log && Date.now() < end) {
      const f = existsSync(logs) && readdirSync(logs).find((n) => n.startsWith('daemon-'));
      if (f && readFileSync(join(logs, f), 'utf8').includes('watching')) log = join(logs, f);
      else await sleep(200);
    }
    assert.ok(log, 'the daemon wrote target/broker/logs/daemon-*.log');
    const lock = JSON.parse(readFileSync(brokerPaths(s.cfg).lock, 'utf8'));
    assert.equal(lock.spawnedBy, 'launch.test: live', 'the lock says who started it and why');
    assert.equal(lock.log, log);
    const parent = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${r.pid}").ParentProcessId`], { encoding: 'utf8' }).stdout.trim();
    if (parent) assert.notEqual(Number(parent), process.pid, 'its parent is not the caller');
    while (Date.now() < end && !readFileSync(log, 'utf8').includes('idle for')) await sleep(200);
    assert.match(readFileSync(log, 'utf8'), /idle for 0\.05 min, exiting/);
  } finally { s.done(); }
});
