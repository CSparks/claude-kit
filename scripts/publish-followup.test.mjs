// publish-followup.test.mjs — the tracked remainder of a two-phase publish (KIT-T839): a failed or unfinished follow-up
// blocks the NEXT publish, a passed one or one still running does not, and orient can show each state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { launchFollowup } from './publish-suite.mjs';
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

test('launchFollowup starts the runner detached with the sha and the runtime root, and records the runner as pending (KIT-T839)', async () => {
  const root = runtime();
  const argvFile = join(root, 'argv.json');
  const script = join(root, 'fake-runner.mjs');
  writeFileSync(script, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));`);
  const pid = launchFollowup(script, root, 'abc1234', FILES);
  const record = readFollowup(root);
  assert.equal(record.state, 'pending');
  assert.equal(record.pid, pid);
  assert.deepEqual(record.files, FILES);
  const deadline = Date.now() + 10_000;
  while (!existsSync(argvFile) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), ['--followup', 'abc1234', '--runtime', root]);
});

test('KIT-D162: a failed follow-up record never blocks a publish, and a publish runs no test (end to end)', () => {
  const root = runtime();
  recordFollowup(root, { sha: 'abc1234', files: FILES, pid: 1 });
  finishFollowup(root, { failed: [FILES[2]] });
  const r = spawnSync(process.execPath, [SCRIPT, '--runtime', root], { encoding: 'utf8', env: { ...process.env, npm_lifecycle_event: 'publish:runtime' } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^runtime: [0-9a-f]{7,40} -> /);
  assert.doesNotMatch(r.stderr, /refusing to publish/);
  assert.doesNotMatch(r.stderr, /runtime-publish phases:/, 'no scratch export was made to run tests in');
});

test('control: outside the npm script the publish still refuses', () => {
  const root = runtime();
  const env = { ...process.env };
  delete env.npm_lifecycle_event;
  const r = spawnSync(process.execPath, [SCRIPT, '--runtime', root], { encoding: 'utf8', env });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refusing - run `npm run publish:runtime`, which exports the committed HEAD and moves `current`/);
  assert.deepEqual(readdirSync(root), []);
});
