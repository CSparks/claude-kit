// stop-running.test.mjs — `stop` takes effect during a deferred re-check or a job's command (KIT-T525):
// plain `stop` cancels an idle re-check at once and lets a running job finish; `stop --now` kills the
// running command's tree, restores the tree from the journal, leaves the job queued and exits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requestStop } from './control.mjs';
import { liveHolder } from './lock.mjs';
import { addDeferred } from './deferred.mjs';
import { readResult, listQueue, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, snapshot } from './patchkit.mjs';
import { tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { for (const end = Date.now() + ms; !fn() && Date.now() < end;) await sleep(100); return fn(); };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const fwd = (p) => p.split(String.fromCharCode(92)).join('/');
const hang = (pidFile) => `node -e "require('fs').writeFileSync('${fwd(pidFile)}',String(process.pid));setInterval(()=>{},1000)"`;

function daemon(s) {
  const child = spawn(process.execPath, [BROKER, '--root', s.root, '--poll', '100'], { stdio: 'ignore' });
  const exited = new Promise((r) => child.on('exit', r));
  return { child, exited, stopped: (ms) => Promise.race([exited, sleep(ms).then(() => 'timeout')]) };
}

test('plain stop cancels a running deferred re-check and the daemon exits', async () => {
  const s = fixture();
  const side = tempDir('stop-def-');
  const pidFile = join(side, 'pid.txt');
  commitOnMain(s.root, 'Cargo.lock', 'base\n', 'lock');
  addDeferred(s.cfg, [{ repo: 'app', test: 't_slow', cmd: hang(pidFile), job: 'j-old', reason: 'r', dirty: [], head: '0'.repeat(40) }]);
  const d = daemon(s);
  try {
    assert.ok(await until(() => existsSync(pidFile)), 're-check command started');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    assert.equal(spawnSync(process.execPath, [BROKER, '--root', s.root, 'stop'], { encoding: 'utf8' }).status, 0);
    assert.equal(await d.stopped(15000), 0, 'daemon exited');
    assert.ok(await until(() => !alive(pid)), 'the re-check process tree is dead');
    assert.equal(liveHolder(s.cfg), null);
  } finally { d.child.kill(); s.done(); }
});

test('plain stop lets a running job finish; the daemon exits after it (control)', async () => {
  const s = fixture();
  const side = tempDir('stop-job-');
  const pidFile = join(side, 'pid.txt');
  const d = daemon(s);
  try {
    const job = { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [`node -e "require('fs').writeFileSync('${fwd(pidFile)}','x');setTimeout(()=>{},1500)"`] };
    writeJob(s.cfg, job);
    assert.ok(await until(() => existsSync(pidFile)), 'job command started');
    requestStop(s.cfg);
    assert.equal(await d.stopped(20000), 0);
    assert.equal(readResult(s.cfg, job.id).status, 'passed', 'the job finished under plain stop');
  } finally { d.child.kill(); s.done(); }
});

test('stop --now kills a running job command, restores the tree, keeps the job queued and exits', async () => {
  const s = fixture();
  const side = tempDir('stop-now-');
  const pidFile = join(side, 'pid.txt');
  const before = snapshot(s.root);
  const d = daemon(s);
  try {
    const job = { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [hang(pidFile)] };
    writeJob(s.cfg, job);
    assert.ok(await until(() => existsSync(pidFile)), 'job command started');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    const t0 = Date.now();
    assert.equal(spawnSync(process.execPath, [BROKER, '--root', s.root, 'stop', '--now'], { encoding: 'utf8' }).status, 0);
    assert.equal(await d.stopped(15000), 0, 'daemon exited');
    assert.ok(Date.now() - t0 < 15000, 'bounded');
    assert.ok(await until(() => !alive(pid)), 'the command tree is dead');
    assert.deepEqual(snapshot(s.root), before, 'tree restored from the journal');
    assert.deepEqual(listQueue(s.cfg).map((j) => j.id), [job.id], 'job stays queued');
    assert.equal(liveHolder(s.cfg), null);
  } finally { d.child.kill(); s.done(); }
});
