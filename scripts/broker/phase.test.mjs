// phase.test.mjs — results carry per-phase timings (KIT-T491) and wait's heartbeat names the
// landing phase a job is in (KIT-T490).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, normalizeBroker } from './config.mjs';
import { heartbeatLine } from './heartbeat.mjs';
import { capture } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { ensureDirs, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const PASS = 'node -e "0"';

const run = (s, flags) => {
  const { job } = buildPatchJob(s.cfg, flags, envelope(['beta', 'BETA']));
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

test('a landing result lists apply, gate, run, commit, pre-push gate and push with their durations', () => {
  const s = fixture();
  try {
    s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: true }] });
    const r = run(s, { ticket: 'T-1', title: 'beta', land: true });
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(r.timings.map((t) => t.phase), ['apply', 'gate', 'run', 'commit', 'pre-push gate', 'push']);
    assert.ok(r.timings.every((t) => Number.isFinite(t.ms) && t.ms >= 0));
  } finally { s.done(); }
});

test('negative: a check-only result stops at run', () => {
  const s = fixture();
  try {
    const r = run(s, { ticket: 'T-1' });
    assert.equal(r.status, 'passed');
    assert.deepEqual(r.timings.map((t) => t.phase), ['apply', 'gate', 'run']);
  } finally { s.done(); }
});

test('the heartbeat names a landing phase and its age; during run it names the command', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const journal = capture(s.cfg, { id: 'j-1-a', cwd: s.root, paths: [] });
    const t0 = Date.parse(journal.startedAt);
    const phase = (p, since) => writeFileSync(join(brokerPaths(s.cfg).home, 'phase.json'), JSON.stringify({ id: 'j-1-a', phase: p, since: new Date(since).toISOString() }));
    phase('pre-push gate', t0 + 60_000);
    assert.equal(heartbeatLine(s.cfg, 'j-1-a', t0 + 600_000), 'wait: j-1-a running 600s, phase pre-push gate for 540s');
    phase('run', t0);
    writeFileSync(join(brokerPaths(s.cfg).logs, 'j-1-a-0.log'), '');
    assert.equal(heartbeatLine(s.cfg, 'j-1-a', t0 + 10_000), 'wait: j-1-a running 10s, on command 1');
  } finally { s.done(); }
});
