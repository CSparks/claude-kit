// idle.test.mjs — a queued job always has a daemon behind it: wait starts one when none is alive,
// orient says DISPATCH NOW while jobs wait with no daemon, and a broker error fails the job it hit
// instead of ending the daemon.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { pause } from './control.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { noDaemonBlock } from './summary.mjs';
import { envelope, fixture, g } from './patchkit.mjs';

const WAIT = join(import.meta.dirname, 'wait.mjs');
const PASS = 'node -e "0"';
const queue = (s, extra = {}) => {
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta', land: true }, envelope(['beta', 'BETA']));
  return writeJob(s.cfg, { ...job, commands: [PASS], ...extra });
};
const run = (args, env) => new Promise((resolve) => {
  const c = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let err = '';
  c.stderr.on('data', (d) => { err += d; });
  c.on('exit', (code) => resolve({ code, err }));
});

test('wait with a job queued and no daemon alive starts one, which runs the job', async () => {
  const s = fixture();
  try {
    const job = queue(s);
    const r = await run([WAIT, job.id, '--root', s.root, '--timeout', '60', '--poll', '200', '--grace-ms', '0']);
    assert.match(r.err, /no daemon was running with .* queued; started one/);
    assert.equal(r.code, 0, r.err);
    assert.equal(readResult(s.cfg, job.id).status, 'landed');
    const logs = readdirSync(brokerPaths(s.cfg).logs).filter((f) => f.startsWith('daemon-'));
    assert.equal(logs.length, 1, 'the daemon it started logs to target/broker/logs');
    assert.match(readFileSync(join(brokerPaths(s.cfg).logs, logs[0]), 'utf8'), /watching/);
  } finally { s.done(); }
});

test('negative control: with autostart off the same wait never starts a daemon and times out', async () => {
  const s = fixture();
  try {
    const job = queue(s);
    const r = await run([WAIT, job.id, '--root', s.root, '--timeout', '3', '--poll', '200', '--grace-ms', '0'], { BROKER_NO_AUTOSTART: '1' });
    assert.equal(r.code, 2);
    assert.equal(listQueue(s.cfg).length, 1);
  } finally { s.done(); }
});

test('orient: jobs queued with no daemon is a DISPATCH NOW block naming the start command; paused or empty is silent', () => {
  const s = fixture();
  try {
    assert.deepEqual(noDaemonBlock(s.root), [], 'no broker home yet');
    queue(s);
    queue(s);
    const block = noDaemonBlock(s.root);
    assert.match(block[0], /^--- DISPATCH NOW: 2 broker job\(s\) queued, no daemon running \(oldest waiting \d+ min\) ---$/);
    assert.match(block[1], /broker\.mjs --root .* --log auto/);
    pause(s.cfg);
    assert.deepEqual(noDaemonBlock(s.root), [], 'an operator pause is not a dead queue');
  } finally { s.done(); }
});

test('a broker error fails the job it hit and the queue moves on; the tree is restored', () => {
  const s = fixture();
  try {
    const bad = queue(s, { repo: 'app', ops: 'not-a-list' });
    const good = queue(s);
    const before = g(['status', '--porcelain'], s.root);
    const sum = processOnce(s.cfg);
    assert.equal(readResult(s.cfg, bad.id).status, 'failed');
    assert.match(readResult(s.cfg, bad.id).message, /^broker error \(the broker's fault/);
    assert.equal(readResult(s.cfg, good.id).status, 'landed', 'the next job still ran');
    assert.equal(sum.processed.length, 2);
    assert.equal(g(['status', '--porcelain'], s.root), before);
    assert.ok(existsSync(join(brokerPaths(s.cfg).home, 'faults.json')));
  } finally { s.done(); }
});
