// train-window.test.mjs — a drain waits for the queue to go quiet before it forms trains (KIT-T548):
// jobs submitted a second apart reach one train instead of the first running alone behind a long
// gate. Controls: with no window the first job runs alone; a queue quiet long enough, and one whose
// oldest job has waited the cap, start at once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { coalesceWait, processOnce } from './queue.mjs';
import { listQueue, readResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture } from './patchkit.mjs';
import { tempDir } from './testkit.mjs';

const DRIVE = join(import.meta.dirname, 'window-drive.mjs');
const PASS = 'node -e "0"';
const WINDOW_MS = 2000;
const GAP_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const at = (agoMs, now) => ({ submittedAt: new Date(now - agoMs).toISOString() });

test('coalesceWait: wait out the quiet window, but never past the cap, and not at all when off or empty', () => {
  const now = Date.now();
  assert.equal(coalesceWait([at(500, now)], 2000, now), 1500);
  assert.equal(coalesceWait([at(9000, now), at(500, now)], 2000, now), 1500);
  assert.equal(coalesceWait([at(2500, now), at(2100, now)], 2000, now), 0, 'quiet for the window');
  assert.equal(coalesceWait([at(10_500, now), at(500, now)], 2000, now), 0, 'the oldest job has waited the cap');
  assert.equal(coalesceWait([at(500, now)], 0, now), 0, 'off');
  assert.equal(coalesceWait([], 2000, now), 0);
});

test('the window is a config key with a default; 0 turns it off', () => {
  assert.equal(normalizeBroker('/x', {}).coalesceMs, 2000);
  assert.equal(normalizeBroker('/x', { coalesce_ms: 750 }).coalesceMs, 750);
  assert.equal(normalizeBroker('/x', { coalesce_ms: 0 }).coalesceMs, 0);
});

// Three disjoint jobs written by a second process a second apart, drained the way the daemon ticks.
async function submitAndDrain(coalesceMs) {
  const s = fixture();
  try {
    const jobs = ['a', 'b', 'c'].map((n) => ({ ...buildPatchJob(s.cfg, { ticket: 'T-1', title: n }, `*** write ${n}.txt\n${n}\n`).job, commands: [PASS] }));
    const jobsFile = join(tempDir('window-'), 'jobs.json');
    writeFileSync(jobsFile, JSON.stringify(jobs));
    const writer = spawn(process.execPath, [DRIVE, s.root, jobsFile, String(GAP_MS)], { stdio: 'ignore', windowsHide: true });
    const end = Date.now() + 60_000;
    let done = false;
    while (Date.now() < end && !done) {
      processOnce(s.cfg, { coalesceMs });
      done = jobs.every((j) => readResult(s.cfg, j.id));
      if (!done) await sleep(200);
    }
    writer.kill();
    assert.ok(done, `all three finished (queue left ${listQueue(s.cfg).length})`);
    return jobs.map((j) => readResult(s.cfg, j.id));
  } finally { s.done(); }
}

test('three submits a second apart form ONE train under the window', async () => {
  const results = await submitAndDrain(WINDOW_MS);
  assert.deepEqual(results.map((r) => r.status), ['passed', 'passed', 'passed']);
  assert.equal(new Set(results.map((r) => r.train && r.train.id)).size, 1, 'one train');
  assert.equal(results[0].train.size, 3);
  assert.equal(results[0].train.builds, 1, 'one build for the three');
});

test('control: with no window the first job runs alone and the rest follow separately', async () => {
  const results = await submitAndDrain(0);
  assert.equal(results[0].train, undefined, 'the first job was taken alone');
  assert.ok(results.every((r) => r.status === 'passed'));
});
