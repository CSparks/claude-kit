// ensure.test.mjs — a daemon stays behind the queue (KIT-T301): submit starts a broker only when
// no live one holds the lock (the spawner is injected, so no test starts a real daemon), and
// wait names the gap instead of timing out silently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { ensureBroker, noBrokerWarning } from './ensure.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;
const lock = (s, pid) => {
  ensureDirs(s.cfg);
  writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid, host: hostname(), ts: new Date().toISOString() }));
};
const queue = (s) => { const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA'])); return writeJob(s.cfg, job).id; };

test('a dead lock starts a broker exactly once; no lock at all does too', () => {
  const s = fixture();
  try {
    const calls = [];
    const spawner = (root, idle) => calls.push([root, idle]);
    lock(s, deadPid());
    assert.equal(ensureBroker(s.cfg, s.root, spawner), true);
    assert.deepEqual(calls, [[s.root, 60]]);
    rmSync(brokerPaths(s.cfg).lock);
    rmSync(brokerPaths(s.cfg).spawning); // the first daemon took the lock and cleared its claim
    assert.equal(ensureBroker(s.cfg, s.root, spawner), true);
    assert.equal(calls.length, 2);
  } finally { s.done(); }
});

test('a live lock starts nothing', () => {
  const s = fixture();
  try {
    lock(s, process.pid);
    const calls = [];
    assert.equal(ensureBroker(s.cfg, s.root, () => calls.push(1)), false);
    assert.equal(calls.length, 0);
  } finally { s.done(); }
});

test('wait with a dead lock and a queued job prints the no-broker warning; a live lock stays quiet', () => {
  const s = fixture();
  try {
    const id = queue(s);
    lock(s, deadPid());
    const waited = spawnSync(process.execPath, [join(import.meta.dirname, 'wait.mjs'), id, '--root', s.root, '--timeout', '1', '--poll', '100', '--grace-ms', '0'], { encoding: 'utf8' });
    assert.equal(waited.status, 2);
    assert.match(waited.stderr, /wait: no broker running/);
    assert.equal(waited.stderr.match(/no broker running/g).length, 1, 'warned once');
    lock(s, process.pid);
    assert.equal(noBrokerWarning(s.cfg, id), null);
    lock(s, deadPid());
    assert.equal(noBrokerWarning(s.cfg, 'j-gone'), null, 'a job no longer queued is not warned about');
  } finally { s.done(); }
});
