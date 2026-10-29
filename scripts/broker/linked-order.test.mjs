// linked-order.mjs — a linked landing job queued behind a submodule landing waits for that submodule's auto-pin instead of
// failing in 0 s with "local main is not under the recorded …" (KIT-D118).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkedHold, PIN_GRACE_MS } from './linked-order.mjs';
import { processOnce } from './queue.mjs';
import { queued, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';

const editBoth = (consumer) => `*** edit rapid-game/api.txt\n<<<<<<< SEARCH\nv1\n=======\nv2\n>>>>>>> REPLACE\n*** edit api.txt\n<<<<<<< SEARCH\nv1\n=======\n${consumer}\n>>>>>>> REPLACE\n`;

// api.txt v1 in both halves and recorded by the superproject.
function recordApi(t) {
  writeFileSync(join(t.sub, 'api.txt'), 'v1\n');
  g(['add', 'api.txt'], t.sub);
  g(['commit', '-m', 'api v1'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  writeFileSync(join(t.root, 'api.txt'), 'v1\n');
  g(['add', 'api.txt', 'rapid-game'], t.root);
  g(['commit', '-m', 'consume api v1'], t.root);
  g(['push', 'origin', 'main'], t.root);
}

// Another landing moves the submodule's local main past the recorded commit while its checkout stays on the recorded one.
function advance(t) {
  const recorded = g(['rev-parse', 'HEAD'], t.sub);
  writeFileSync(join(t.sub, 'other.txt'), 'x\n');
  g(['add', 'other.txt'], t.sub);
  g(['commit', '-m', 'another landing'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  const newSha = g(['rev-parse', 'HEAD'], t.sub);
  g(['checkout', '-q', '--detach', recorded], t.sub);
  return newSha;
}

function moved(t) {
  recordApi(t);
  const linked = buildPatchJob(t.cfg, { ticket: 'T-9', land: true, title: 'api v2' }, editBoth('v2')).job;
  return { linked: { ...linked, commands: [PASS] }, newSha: advance(t) };
}

const pinJob = (t, sha) => ({ ...buildPatchJob(t.cfg, { ticket: 'T-9', title: 'pin rapid-game', pin: `rapid-game=${sha}`, 'no-patch': true, land: true, 'auto-pin': 'j-origin' }, '').job, commands: [PASS] });

test('the linked job queued before its submodule auto-pin waits, then lands once the pin has: no failed result in between', () => {
  const t = setup();
  try {
    const { linked, newSha } = moved(t);
    const pin = pinJob(t, newSha);
    writeJob(t.cfg, linked);
    writeJob(t.cfg, pin);
    const first = processOnce(t.cfg);
    assert.deepEqual(first.processed.map((r) => r.id), [pin.id], 'only the pin ran');
    assert.equal(readResult(t.cfg, pin.id).status, 'landed');
    assert.equal(readResult(t.cfg, linked.id), null, 'the linked job has no result: it was not failed back to the agent');
    assert.equal(queued(t.cfg, linked.id), true, 'it stays queued');
    assert.match(first.waiting.join(' '), new RegExp(`${linked.id} waits for auto-pin ${pin.id}`));
    const second = processOnce(t.cfg);
    assert.deepEqual(second.processed.map((r) => r.id), [linked.id]);
    assert.equal(readResult(t.cfg, linked.id).status, 'landed');
    assert.equal(g(['status', '--porcelain'], t.root), '');
  } finally { t.done(); }
});

test('control: with no pin ever queued the job is held for the grace, then runs and fails with the plain refusal', () => {
  const t = setup();
  try {
    const { linked } = moved(t);
    writeJob(t.cfg, linked);
    assert.match(linkedHold(t.cfg, linked, [], { now: 0 }).reason, /none queued yet/, 'within the grace it is held');
    assert.equal(linkedHold(t.cfg, linked, [], { now: PIN_GRACE_MS + 1 }), null, 'past the grace it runs');
    processOnce(t.cfg);
    const r = readResult(t.cfg, linked.id);
    assert.equal(r.status, 'failed');
    assert.match(JSON.stringify(r), /is not under the recorded/);
  } finally { t.done(); }
});

test('control: not held when the submodule has not moved, for a job touching no submodule path, or for a pin job', () => {
  const t = setup();
  try {
    recordApi(t);
    const linked = buildPatchJob(t.cfg, { ticket: 'T-9', land: true }, editBoth('v2')).job;
    const queuedPin = { id: 'j-pin', autoPin: 'x', land: true, pins: [{ repo: 'rapid-game' }] };
    assert.equal(linkedHold(t.cfg, linked, [queuedPin]), null, 'main sits at the recorded commit');
    const newSha = advance(t);
    const own = buildPatchJob(t.cfg, { ticket: 'T-9', land: true }, '*** write own.txt\nhello\n').job;
    assert.equal(linkedHold(t.cfg, own, [queuedPin]), null, 'a superproject-only job is never held');
    assert.equal(linkedHold(t.cfg, pinJob(t, newSha), [queuedPin]), null, 'a pin job is never held');
    assert.ok(linkedHold(t.cfg, linked, [queuedPin]), 'control: the moved linked job is held');
  } finally { t.done(); }
});
