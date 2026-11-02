// publish-followup.mjs — the tracked remainder of a two-phase publish (KIT-T839, KIT-D104).
//
// A publish gates on the test files its change reaches that fit the time budget. The reached files that did not
// fit are recorded here and run after `current` moves; the result gates the NEXT publish, never the one that
// recorded it. State lives in <runtime>/publish-followup.json:
//   { sha, files, state: 'pending' | 'passed' | 'failed', failed, pid, startedAt, finishedAt }
//
//   recordFollowup(runtimeRoot, { sha, files, pid })  -> state 'pending' (the process that runs the remainder)
//   claimFollowup(runtimeRoot, pid)                   -> names the process now running the remainder
//   finishFollowup(runtimeRoot, { failed })           -> 'passed' when `failed` is empty, else 'failed'
//   readFollowup(runtimeRoot)                         -> the record, or null
//   followupBlocker(runtimeRoot, { isAlive })         -> why the next publish must refuse, or '' (failed, or pending with
//                                                        a dead runner; a live runner or a passed record never blocks)
//   followupLine(runtimeRoot, { isAlive })            -> one orient line ('!! ' leads a blocking one), or '' with no record
//   followupFiles(record)                             -> the files a re-run covers: the failed ones, else the whole remainder

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { alive } from './runtime-publish-guard.mjs';

const FILE = 'publish-followup.json';
const NAMES_SHOWN = 6;
const RERUN = 'npm run publish:followup';

const pathOf = (runtimeRoot) => join(runtimeRoot, FILE);

export function readFollowup(runtimeRoot) {
  try { return JSON.parse(readFileSync(pathOf(runtimeRoot), 'utf8')); } catch { return null; }
}

const write = (runtimeRoot, record) => writeFileSync(pathOf(runtimeRoot), `${JSON.stringify(record, null, 2)}\n`);

export function recordFollowup(runtimeRoot, { sha, files, pid = process.pid, now = new Date() }) {
  write(runtimeRoot, { sha, files, state: 'pending', failed: [], pid, startedAt: now.toISOString(), finishedAt: null });
}

export function claimFollowup(runtimeRoot, pid) {
  const record = readFollowup(runtimeRoot);
  if (record) write(runtimeRoot, { ...record, pid });
}

export function finishFollowup(runtimeRoot, { failed = [], now = new Date() } = {}) {
  const record = readFollowup(runtimeRoot);
  if (!record) return null;
  const done = { ...record, state: failed.length ? 'failed' : 'passed', failed, finishedAt: now.toISOString() };
  write(runtimeRoot, done);
  return done;
}

export const followupFiles = (record) => (record.failed?.length ? record.failed : record.files);

const names = (files) => `${files.slice(0, NAMES_SHOWN).join(', ')}${files.length > NAMES_SHOWN ? `, ... (${files.length} in all)` : ''}`;

export function followupBlocker(runtimeRoot, { isAlive = alive } = {}) {
  const record = readFollowup(runtimeRoot);
  if (!record) return '';
  if (record.state === 'failed') return `the follow-up tests of publish ${record.sha} failed: ${names(record.failed)}. Fix them, commit, then run \`${RERUN}\` until it passes.`;
  if (record.state === 'pending' && !isAlive(record.pid)) return `the follow-up tests of publish ${record.sha} never finished (runner pid ${record.pid} is gone). Run \`${RERUN}\` to finish them.`;
  return '';
}

export function followupLine(runtimeRoot, { isAlive = alive } = {}) {
  const record = readFollowup(runtimeRoot);
  if (!record) return '';
  const owed = `${record.files.length} test file(s) owed by publish ${record.sha}`;
  if (record.state === 'passed') return `PUBLISH FOLLOW-UP passed: ${owed} ran green at ${record.finishedAt}`;
  if (record.state === 'failed') return `!! PUBLISH FOLLOW-UP FAILED (blocks the next publish): ${names(record.failed)} of ${owed}. Fix, commit, run \`${RERUN}\`.`;
  return isAlive(record.pid)
    ? `PUBLISH FOLLOW-UP running (pid ${record.pid} since ${record.startedAt}): ${owed}`
    : `!! PUBLISH FOLLOW-UP never finished (blocks the next publish): ${owed}. Run \`${RERUN}\`.`;
}
