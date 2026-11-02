// publish-suite.mjs — the kit test suite as a publish runs it (KIT-D104, KIT-T839): the same npm script a writer runs, on an
// exported tree, with the time record shared with the source checkout.
//
//   publishSuite(dir, { changed })     -> the owed test files: the files the change reaches that did not fit the
//                                         budget (a two-phase publish runs them after `current` moves); throws when red
//   followupSuite(dir, files)          -> the failed files (run exactly `files`, no budget); throws when the run cannot start
//   launchFollowup(repoScript, runtimeRoot, sha) -> starts the detached runner of the recorded remainder and records it

import { mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { CHILD_OPTIONS } from './runtime-publish-guard.mjs';
import { recordFollowup, claimFollowup } from './publish-followup.mjs';

const PUBLISH_BUDGET_S = 120; // the suite share of the 180 s foreground window a harness gives one command, export and publish steps included
const FOLLOWUP_LOG = 'publish-followup.log';
const HERE = dirname(fileURLToPath(import.meta.url));
const timesFile = join(HERE, '..', '.cache', 'test-times.json');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function npmTest(dir, env) {
  const r = spawnSync(npm, ['test'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, KIT_TEST_TIMES: timesFile, ...env }, ...CHILD_OPTIONS });
  return r.status;
}

const readList = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return []; } };

function withScratchFile(name, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-publish-'));
  try { return fn(join(dir, name)); } finally { rmSync(dir, { recursive: true, force: true }); }
}

export function publishSuite(dir, { changed } = {}) {
  return withScratchFile('owed.json', (owedPath) => {
    const env = { KIT_TEST_BUDGET_S: String(PUBLISH_BUDGET_S), KIT_TEST_OWED_FILE: owedPath, ...(changed === undefined ? {} : { KIT_TEST_CHANGED: changed }) };
    const status = npmTest(dir, env);
    if (status !== 0) throw new Error(`the suite is red on exported HEAD (exit ${status}); current did not move`);
    return readList(owedPath);
  });
}

export function followupSuite(dir, files) {
  return withScratchFile('files.json', (listPath) => {
    writeFileSync(listPath, JSON.stringify(files));
    const failedPath = `${listPath}.failed`;
    const status = npmTest(dir, { KIT_TEST_FILES: listPath, KIT_TEST_FAILED_FILE: failedPath });
    const failed = readList(failedPath);
    if (status !== 0 && !failed.length) throw new Error(`the follow-up run exited ${status} without naming a failed file`);
    return failed;
  });
}

export function launchFollowup(script, runtimeRoot, sha, files) {
  recordFollowup(runtimeRoot, { sha, files });
  const log = openSync(join(runtimeRoot, FOLLOWUP_LOG), 'w');
  const child = spawn(process.execPath, [script, '--followup', sha], { detached: true, stdio: ['ignore', log, log], ...CHILD_OPTIONS });
  child.unref();
  claimFollowup(runtimeRoot, child.pid);
  return child.pid;
}
