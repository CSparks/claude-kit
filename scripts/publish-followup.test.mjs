// publish-followup.test.mjs — the tracked remainder of a two-phase publish (KIT-T839): a failed or unfinished follow-up
// blocks the NEXT publish, a passed one or one still running does not, and orient can show each state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { claimFollowup, finishFollowup, followupBlocker, followupFiles, followupLine, readFollowup, recordFollowup } from './publish-followup.mjs';

const SCRIPT = join(import.meta.dirname, 'runtime-publish.mjs');
const LIVE = () => true;
const DEAD = () => false;
const FILES = ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'scripts/c.test.mjs'];
const runtime = () => mkdtempSync(join(tmpdir(), 'followup-'));

test('no record: nothing blocks and orient says nothing', () => {
  const root = runtime();
  assert.equal(readFollowup(root), null);
  assert.equal(followupBlocker(root, { isAlive: DEAD }), '');
  assert.equal(followupLine(root, { isAlive: DEAD }), '');
  assert.equal(finishFollowup(root, { failed: [] }), null);
});

test('a follow-up that fails blocks the next publish, names the files and the re-run command, and shows at orient', () => {
  const root = runtime();
  recordFollowup(root, { sha: 'abc1234', files: FILES, pid: 1 });
  finishFollowup(root, { failed: [FILES[1]] });
  const blocker = followupBlocker(root, { isAlive: LIVE });
  assert.match(blocker, /abc1234 failed: scripts\/b\.test\.mjs/);
  assert.match(blocker, /npm run publish:followup/);
  assert.match(followupLine(root, { isAlive: LIVE }), /^!! PUBLISH FOLLOW-UP FAILED \(blocks the next publish\): scripts\/b\.test\.mjs of 3 test file/);
  assert.deepEqual(followupFiles(readFollowup(root)), [FILES[1]], 'a re-run covers only the failed file');
});

test('negative control: a clean follow-up does not block, and shows as passed', () => {
  const root = runtime();
  recordFollowup(root, { sha: 'abc1234', files: FILES, pid: 1 });
  finishFollowup(root, { failed: [] });
  assert.equal(followupBlocker(root, { isAlive: DEAD }), '');
  assert.match(followupLine(root, { isAlive: DEAD }), /^PUBLISH FOLLOW-UP passed: 3 test file/);
  assert.deepEqual(followupFiles(readFollowup(root)), FILES);
});

test('a follow-up still running does not block; one whose runner died without a result does', () => {
  const root = runtime();
  recordFollowup(root, { sha: 'abc1234', files: FILES, pid: 1 });
  claimFollowup(root, 4242);
  assert.equal(readFollowup(root).pid, 4242);
  assert.equal(followupBlocker(root, { isAlive: LIVE }), '');
  assert.match(followupLine(root, { isAlive: LIVE }), /^PUBLISH FOLLOW-UP running \(pid 4242/);
  assert.match(followupBlocker(root, { isAlive: DEAD }), /never finished \(runner pid 4242 is gone\)/);
  assert.match(followupLine(root, { isAlive: DEAD }), /^!! PUBLISH FOLLOW-UP never finished/);
});

test('a re-run that passes clears a failed record', () => {
  const root = runtime();
  recordFollowup(root, { sha: 'abc1234', files: FILES, pid: 1 });
  finishFollowup(root, { failed: [FILES[0]] });
  finishFollowup(root, { failed: [] });
  assert.equal(followupBlocker(root, { isAlive: DEAD }), '');
});

test('npm run publish:runtime refuses before touching anything while a follow-up is failed (end to end)', () => {
  const root = runtime();
  recordFollowup(root, { sha: 'abc1234', files: FILES, pid: 1 });
  finishFollowup(root, { failed: [FILES[2]] });
  const r = spawnSync(process.execPath, [SCRIPT, '--runtime', root], { encoding: 'utf8', env: { ...process.env, npm_lifecycle_event: 'publish:runtime' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refusing to publish: the follow-up tests of publish abc1234 failed: scripts\/c\.test\.mjs/);
  assert.deepEqual(readdirSync(root), ['publish-followup.json'], 'no lock, export or scratch was created');
});
