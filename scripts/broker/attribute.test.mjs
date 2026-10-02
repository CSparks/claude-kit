// attribute.test.mjs — failure attribution (KIT-T271): a failure the patch did not cause never
// blocks a job. Fixture "tests" are node one-liners printing libtest-shaped lines; the baseline
// rerun appends `-- --exact <names>`, which node ignores, so a test passes or fails by what is
// on disk (marker.txt present = the patch is applied).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselineCommand } from './attribute.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { printResult } from './report.mjs';
import { fixture, g } from './patchkit.mjs';

// Fails `always` unconditionally; fails `patched` only while marker.txt exists.
const suite = ({ always = true, patched = false, compile = false } = {}) => {
  const code = [
    `const fs=require('fs');const on=fs.existsSync('marker.txt');let bad=0;`,
    compile ? `console.log('error[E0425]: cannot find value');console.log(' --> src/lib.rs:1:1');process.exit(1);` : '',
    always ? `console.log('test a_foreign ... FAILED');console.log('---- a_foreign stdout ----');console.log('boom: hot edit');bad=1;` : '',
    patched ? `if(on){console.log('test b_caused ... FAILED');bad=1}` : '',
    `process.exit(bad)`,
  ].join('');
  return `node -e "${code.replaceAll('"', '\\"')}"`;
};

const run = (s, cmd, flags = {}) => {
  const { job } = buildPatchJob(s.cfg, flags, '*** write marker.txt\nm\n');
  writeJob(s.cfg, { ...job, commands: [cmd] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

test('baselineCommand: nextest expression and libtest exact filter', () => {
  assert.equal(baselineCommand('cargo nextest run -p x', ['a', 'b']), 'cargo nextest run -p x -E "test(=a) or test(=b)"');
  assert.equal(baselineCommand('cargo t -p x', ['a']), 'cargo t -p x -- --exact a');
  assert.equal(baselineCommand('cargo t -- --nocapture', ['a']), 'cargo t -- --nocapture --exact a');
});

test('a test failing with and without the patch is foreign: the job passes and lists it', () => {
  const s = fixture();
  try {
    const r = run(s, suite());
    assert.equal(r.status, 'passed');
    assert.deepEqual(r.foreign.map((f) => f.test), ['a_foreign']);
    assert.match(r.foreign[0].reason, /boom/);
    const lines = []; printResult(r, (l) => lines.push(l));
    assert.ok(lines.some((l) => l.includes('foreign') && l.includes('a_foreign')));
  } finally { s.done(); }
});

test('a foreign failure still lands a --land job, patch re-applied and committed by path', () => {
  const s = fixture();
  try {
    const r = run(s, suite(), { land: true, ticket: 'T-1', title: 'add marker' });
    assert.equal(r.status, 'landed');
    assert.deepEqual(r.foreign.map((f) => f.test), ['a_foreign']);
    assert.equal(g(['show', '--name-only', '--pretty=format:', 'HEAD'], s.root).trim(), 'marker.txt');
    assert.equal(readFileSync(join(s.root, 'marker.txt'), 'utf8'), 'm\n');
  } finally { s.done(); }
});

test('a test failing only with the patch fails the job, even beside a foreign failure', () => {
  const s = fixture();
  try {
    const r = run(s, suite({ patched: true }));
    assert.equal(r.status, 'failed');
    assert.deepEqual(r.commands[0].failedTests, ['a_foreign', 'b_caused']);
    assert.equal(r.commands[0].foreign, undefined);
    assert.equal(g(['status', '--porcelain'], s.root).includes('marker.txt'), false, 'tree restored');
  } finally { s.done(); }
});

test('a compile error is never attributed', () => {
  const s = fixture();
  try {
    const r = run(s, suite({ compile: true }));
    assert.equal(r.status, 'failed');
    assert.deepEqual(r.foreign, []);
  } finally { s.done(); }
});

test('a dirty file the patch does not touch keeps its exact bytes through the baseline run', () => {
  const s = fixture();
  try {
    const bytes = 'half-finished\r\n\0edit';
    writeFileSync(join(s.root, 'src.txt'), bytes);
    const r = run(s, suite());
    assert.equal(r.status, 'passed');
    assert.equal(readFileSync(join(s.root, 'src.txt'), 'utf8'), bytes);
  } finally { s.done(); }
});
