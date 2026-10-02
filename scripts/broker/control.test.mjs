// control.test.mjs — operator controls and the orient summary (KIT-T276 L5): pause/resume,
// the daemon's idle exit, and the banner lines for in-flight and landed patches.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { isPaused, pause, resume } from './control.mjs';
import { capture } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { brokerLines } from './summary.mjs';
import { envelope, fixture } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const daemon = (root, ...args) => spawnSync(process.execPath, [BROKER, ...args, '--root', root], { encoding: 'utf8', timeout: 20000 });

test('pause stops the queue from starting jobs; resume runs them', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    pause(s.cfg);
    assert.equal(isPaused(s.cfg), true);
    assert.deepEqual(processOnce(s.cfg), { processed: [], paused: true, reason: 'manual' });
    assert.equal(listQueue(s.cfg).length, 1);
    resume(s.cfg);
    assert.equal(processOnce(s.cfg).paused, false);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
  } finally { s.done(); }
});

test('broker.mjs pause / resume write and clear the marker; --idle-exit stops an idle daemon and frees the lock', () => {
  const s = fixture();
  try {
    assert.equal(daemon(s.root, 'pause').status, 0);
    assert.equal(isPaused(s.cfg), true);
    assert.equal(daemon(s.root, 'resume').status, 0);
    assert.equal(isPaused(s.cfg), false);
    const r = daemon(s.root, '--idle-exit', '0.002', '--poll', '40');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /idle for/);
    assert.equal(daemon(s.root, '--once').status, 0, 'lock was released');
  } finally { s.done(); }
});

test('orient lines list the patch in flight and landings since the last look, once', () => {
  const s = fixture();
  try {
    assert.deepEqual(brokerLines(s.root), [], 'no broker home yet');
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-5', land: true, title: 'x' }, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    processOnce(s.cfg);
    const first = brokerLines(s.root, Date.now() + 1000);
    assert.match(first[0], /^broker: daemon not running/);
    assert.ok(first.some((l) => l.includes('landed') && l.includes('T-5')), first.join('\n'));
    assert.deepEqual(brokerLines(s.root, Date.now() + 2000).filter((l) => l.includes('landed')), [], 'already seen');

    capture(s.cfg, { id: 'j-live', cwd: s.root, paths: ['src.txt'] });
    assert.ok(brokerLines(s.root).some((l) => l.includes('in flight: j-live')));
  } finally { s.done(); }
});

test('the orient hook prints the broker lines', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-6', land: true, title: 'x' }, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    processOnce(s.cfg);
    const orient = join(import.meta.dirname, '..', '..', 'hooks', 'orient.mjs');
    const out = spawnSync(process.execPath, [orient], { cwd: s.root, encoding: 'utf8', input: '{}' }).stdout;
    assert.match(out, /broker: daemon not running/);
    assert.match(out, /landed [0-9a-f]{8} T-6/);
  } finally { s.done(); }
});
