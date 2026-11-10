// handover.test.mjs — a daemon handing its lane to the published runtime names the hand-over as the successor's
// reason and never loses the lane when the launch fails (KIT-T957). The lock is a real file under a fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { handOver, handoverArgs } from './handover.mjs';
import { acquireLock, liveHolder } from './lock.mjs';
import { fixture } from './patchkit.mjs';

const ARGV = ['--root', 'D:/x', '--lane', 'rapid-game', '--idle-exit', '60', '--spawned-by', 'submit.mjs pid 63796: 1 job(s) queued with no daemon', '--log', 'auto'];

test('the successor argv drops the launcher flags and the first daemon\'s spawn reason, and names the hand-over', () => {
  assert.deepEqual(handoverArgs(ARGV, 'broker.mjs pid 9: runtime a superseded by published b'), ['--lane', 'rapid-game', '--idle-exit', '60', '--spawned-by', 'broker.mjs pid 9: runtime a superseded by published b']);
  assert.deepEqual(handoverArgs([], 'r'), ['--spawned-by', 'r'], 'control: nothing to drop');
});

test('a successful launch releases the lock and starts the published broker with the new reason', () => {
  const s = fixture();
  try {
    assert.ok(acquireLock(s.cfg).ok);
    const calls = [];
    const r = handOver({ cfg: s.cfg, root: s.root, argv: ARGV, why: 'runtime a superseded by published b', current: '/rt/current', canStay: true, pid: 9, launch: (script, root, args) => { calls.push({ script, args }); return { ok: true }; } });
    assert.deepEqual(r, { handedOver: true });
    assert.equal(existsSync(brokerPaths(s.cfg).lock), false, 'the lock is free for the successor');
    assert.equal(calls[0].script, join('/rt/current', 'scripts', 'broker', 'broker.mjs'));
    assert.equal(calls[0].args.at(-1), 'broker.mjs pid 9: runtime a superseded by published b');
  } finally { s.done(); }
});

test('a failed launch keeps the lane with this daemon; control: a runtime that cannot run on lets the daemon go', () => {
  const s = fixture();
  try {
    assert.ok(acquireLock(s.cfg).ok);
    const failed = handOver({ cfg: s.cfg, root: s.root, argv: ARGV, why: 'w', current: '/rt/current', canStay: true, launch: () => ({ ok: false, error: 'Win32_Process.Create failed' }) });
    assert.deepEqual(failed, { handedOver: false, error: 'Win32_Process.Create failed', stayed: true });
    assert.equal(liveHolder(s.cfg).pid, process.pid, 'the lock is held again');

    const gone = handOver({ cfg: s.cfg, root: s.root, argv: ARGV, why: 'w', current: '/rt/current', canStay: false, launch: () => ({ ok: false, error: 'boom' }) });
    assert.equal(gone.stayed, false);
    assert.equal(liveHolder(s.cfg), null, 'the daemon exits and leaves the lock free for the next submit or supervisor');

    const none = handOver({ cfg: s.cfg, root: s.root, argv: ARGV, why: 'w', current: null, canStay: false });
    assert.match(none.error, /no published runtime/);
  } finally { s.done(); }
});
