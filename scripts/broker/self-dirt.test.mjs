// self-dirt.test.mjs — the broker puts back dirt it provably caused (a tracked file a broker job wrote,
// now differing from HEAD only in line endings) instead of pausing; anything else still pauses untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';

const PASS = 'node -e "0"';
const BASE = 'fn a() {}\nfn b() {}\n';
const rsEdit = (file) => `*** edit ${file}\n<<<<<<< SEARCH\nfn a() {}\n=======\nfn a() { 1; }\n>>>>>>> REPLACE\n`;

function run(s, envelope) {
  const { job } = buildPatchJob(s.cfg, {}, envelope);
  writeJob(s.cfg, { ...job, commands: [PASS] });
  const sum = processOnce(s.cfg);
  return { sum, result: readResult(s.cfg, job.id) };
}

// lib.rs and other.rs are tracked; a check-only job over lib.rs makes the broker a writer of it.
function tree() {
  const s = fixture();
  commitOnMain(s.root, 'lib.rs', BASE, 'add lib');
  commitOnMain(s.root, 'other.rs', BASE, 'add other');
  assert.equal(run(s, rsEdit('lib.rs')).result.status, 'passed');
  return s;
}

const crlf = (text) => text.replace(/\n/g, '\r\n');

test('an EOL-only leftover of a file a broker job wrote is put back and the queue runs', () => {
  const s = tree();
  try {
    writeFileSync(join(s.root, 'lib.rs'), crlf(BASE));
    assert.match(g(['status', '--porcelain', '--untracked-files=no'], s.root), /M lib\.rs/);
    const { sum, result } = run(s, rsEdit('lib.rs'));
    assert.equal(sum.paused, false, JSON.stringify(sum));
    assert.equal(result.status, 'passed', JSON.stringify(result));
    assert.equal(readFileSync(join(s.root, 'lib.rs'), 'utf8'), BASE, 'restored from HEAD');
  } finally { s.done(); }
});

test('control: a hand edit to the same file still pauses and is left untouched', () => {
  const s = tree();
  try {
    const mine = 'fn a() {}\nfn b() {}\nfn hand_edit() {}\n';
    writeFileSync(join(s.root, 'lib.rs'), mine);
    const { sum, result } = run(s, rsEdit('other.rs'));
    assert.equal(sum.paused, true);
    assert.equal(result.status, 'dirty');
    assert.equal(readFileSync(join(s.root, 'lib.rs'), 'utf8'), mine);
  } finally { s.done(); }
});

test('control: an EOL-only change to a file no broker job wrote still pauses and is left untouched', () => {
  const s = tree();
  try {
    writeFileSync(join(s.root, 'other.rs'), crlf(BASE));
    const { sum, result } = run(s, rsEdit('lib.rs'));
    assert.equal(sum.paused, true);
    assert.equal(result.status, 'dirty');
    assert.equal(readFileSync(join(s.root, 'other.rs'), 'utf8'), crlf(BASE));
  } finally { s.done(); }
});

test('control: a hand edit that also changes line endings of a broker-written file pauses', () => {
  const s = tree();
  try {
    const mine = crlf('fn a() {}\nfn changed() {}\n');
    writeFileSync(join(s.root, 'lib.rs'), mine);
    const { sum } = run(s, rsEdit('other.rs'));
    assert.equal(sum.paused, true);
    assert.equal(readFileSync(join(s.root, 'lib.rs'), 'utf8'), mine);
  } finally { s.done(); }
});
