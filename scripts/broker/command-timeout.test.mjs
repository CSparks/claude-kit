// command-timeout.test.mjs — a job command past its limit is killed with its process tree and the job
// fails "timed out"; `cancel <id> --running` does the same on request and the job ends cancelled (KIT-T676).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commandHistoryMs, commandLimitMs } from './command-limit.mjs';
import { normalizeBroker } from './config.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { liveHolder } from './lock.mjs';
import { readResult, listQueue, writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, snapshot } from './patchkit.mjs';
import { tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 60000) => { for (const end = Date.now() + ms; !fn() && Date.now() < end;) await sleep(100); return fn(); };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const fwd = (p) => p.split(String.fromCharCode(92)).join('/');
const hang = (pidFile) => `node -e "require('fs').writeFileSync('${fwd(pidFile)}',String(process.pid));setInterval(()=>{},1000)"`;

function timeoutFixture(floorS) {
  const s = fixture();
  writeFileSync(join(s.root, '.ai', 'config.yml'), `broker:\n  command_timeout_floor_s: ${floorS}\n  repos:\n    - { name: app, path: ., main: main, remote: origin }\n`);
  return s;
}

function daemon(s) {
  const child = spawn(process.execPath, [BROKER, '--root', s.root, '--poll', '100'], { stdio: 'ignore' });
  return { child };
}

const hangJob = (s, pidFile) => ({ ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [hang(pidFile)] });

test('the limit is a multiple of the longest passing run of that command, never below the floor', () => {
  const s = fixture();
  try {
    const cfg = normalizeBroker(s.root, { command_timeout_multiple: 3, command_timeout_floor_s: 10, repos: [] });
    assert.equal(commandLimitMs(cfg, 'cargo t'), 10000, 'no history: the floor');
    writeResult(s.cfg, { id: 'j-a', repo: 'app', status: 'passed', commands: [{ cmd: 'cargo t', exit: 0, durationMs: 20000 }, { cmd: 'cargo t', exit: 1, durationMs: 90000 }, { cmd: 'cargo b', exit: 0, durationMs: 50000 }] });
    const withHistory = { ...cfg, targetDir: s.cfg.targetDir };
    assert.equal(commandHistoryMs(withHistory, 'cargo t'), 20000, 'only passing runs of that command count');
    assert.equal(commandLimitMs(withHistory, 'cargo t'), 60000, 'three times the longest passing run');
    assert.equal(commandLimitMs({ ...withHistory, commandTimeout: { multiple: 3, floorMs: 0 } }, 'cargo t'), 0, 'floor 0 turns it off');
  } finally { s.done(); }
});

test('runCancellable kills the tree of a command past timeoutMs and reports timedOut', async () => {
  const side = tempDir('timeout-unit-');
  const pidFile = join(side, 'pid.txt');
  const r = runCancellable(hang(pidFile), { cwd: side, targetDir: side, logPath: join(side, 'o.log'), jobs: 1, timeoutMs: 1500 }, { shouldCancel: () => false, pollMs: 50 });
  assert.equal(r.timedOut, true);
  assert.notEqual(r.exit, 0);
  assert.ok(r.durationMs < 30000);
  const pid = Number(readFileSync(pidFile, 'utf8'));
  assert.ok(await until(() => !alive(pid)), 'the command process is dead');
});

test('negative control: a command inside its limit is not touched', () => {
  const side = tempDir('timeout-ok-');
  const r = runCancellable('node -e "process.exit(0)"', { cwd: side, targetDir: side, logPath: join(side, 'o.log'), jobs: 1, timeoutMs: 60000 }, { shouldCancel: () => false, pollMs: 50 });
  assert.equal(r.exit, 0);
  assert.equal(r.timedOut, undefined);
});

test('a hung job command is killed at its limit; the job fails "timed out" and the lane moves on', async () => {
  const s = timeoutFixture(2);
  const pidFile = join(tempDir('timeout-job-'), 'pid.txt');
  const before = snapshot(s.root);
  const d = daemon(s);
  try {
    const job = hangJob(s, pidFile);
    writeJob(s.cfg, job);
    assert.ok(await until(() => readResult(s.cfg, job.id)), 'the job got a result');
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.match(r.message, /timed out/);
    assert.equal(r.commands[0].aborted.kind, 'timeout');
    assert.match(readFileSync(r.commands[0].log, 'utf8'), /\[broker\] timed out/);
    assert.ok(await until(() => !alive(Number(readFileSync(pidFile, 'utf8')))), 'the command tree is dead');
    assert.deepEqual(snapshot(s.root), before, 'tree restored');
    assert.ok(await until(() => !listQueue(s.cfg).length), 'the job left the queue');
  } finally { d.child.kill(); s.done(); }
});

test('cancel --running kills the running job command tree and the job ends cancelled', async () => {
  const s = timeoutFixture(0);
  const pidFile = join(tempDir('cancel-run-'), 'pid.txt');
  const before = snapshot(s.root);
  const d = daemon(s);
  try {
    const job = hangJob(s, pidFile);
    writeJob(s.cfg, job);
    assert.ok(await until(() => existsSync(pidFile)), 'command started');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    const plain = spawnSync(process.execPath, [BROKER, '--root', s.root, 'cancel', job.id], { encoding: 'utf8' });
    assert.equal(plain.status, 1, 'a plain cancel still refuses a running job');
    assert.match(plain.stderr, /--running/);
    const c = spawnSync(process.execPath, [BROKER, '--root', s.root, 'cancel', job.id, '--running'], { encoding: 'utf8' });
    assert.equal(c.status, 0, c.stderr);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'cancelled');
    assert.match(r.message, /cancelled by the operator/);
    assert.ok(await until(() => !alive(pid)), 'the command tree is dead');
    assert.deepEqual(snapshot(s.root), before, 'tree restored');
    assert.ok(await until(() => !listQueue(s.cfg).length), 'the job left the queue');
    assert.ok(liveHolder(s.cfg), 'the daemon carries on');
  } finally { d.child.kill(); s.done(); }
});

test('cancel --running on a job that is not running is refused', () => {
  const s = timeoutFixture(0);
  try {
    const job = hangJob(s, join(tempDir('cancel-idle-'), 'pid.txt'));
    writeJob(s.cfg, job);
    const c = spawnSync(process.execPath, [BROKER, '--root', s.root, 'cancel', job.id, '--running'], { encoding: 'utf8' });
    assert.equal(c.status, 1);
    assert.match(c.stderr, /is not running/);
    assert.equal(listQueue(s.cfg).length, 1, 'the queued job is untouched');
  } finally { s.done(); }
});
