// attribute.test.mjs — failure attribution (KIT-T271): a failure the patch did not cause never
// blocks a job. Fixture "tests" are node one-liners printing libtest-shaped lines; the baseline
// rerun appends `-- --exact <names>`, which node ignores, so a test passes or fails by what is
// on disk (marker.txt present = the patch is applied).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attribute, baselineCommand } from './attribute.mjs';
import { diagnose } from './diagnose.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { printResult } from './report.mjs';
import { fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

// Fails `always` unconditionally; fails `patched` only while marker.txt exists.
const suite = ({ always = true, patched = false, compile = false } = {}) => {
  const code = [
    `const fs=require('fs');const on=fs.existsSync('marker.txt');let bad=0;`,
    compile ? `console.log('error[E0425]: cannot find value');console.log(' --> src/lib.rs:1:1');process.exit(1);` : '',
    always ? `console.log('test a_foreign ... FAILED');console.log('---- a_foreign stdout ----');console.log('boom: hot edit');bad=1;` : '',
    patched ? `if(on){console.log('test b_caused ... FAILED');bad=1}else console.log('test b_caused ... ok');` : '',
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

const NEXTEST_LOG = [
  '        FAIL [   0.120s] (38/48) editor::the_asset_tool_discovers_every_script the_catalog_matches_the_full_authored_inventory',
  '        FAIL [   0.010s] ( 5/48) rg-scene scene::terrain::landform::tests::foo',
  '        PASS [   0.010s] ( 6/48) rg-scene scene::terrain::landform::tests::bar',
].join('\n');

test('diagnose: nextest binary id and test name are separate, counter skipped', () => {
  const d = diagnose(NEXTEST_LOG);
  assert.deepEqual(d.failed, [
    { binary: 'editor::the_asset_tool_discovers_every_script', test: 'the_catalog_matches_the_full_authored_inventory' },
    { binary: 'rg-scene', test: 'scene::terrain::landform::tests::foo' },
  ]);
  assert.equal(d.passed.length, 1);
});

// A nextest failure run ends with a summary and `error: test run failed`; that is not a build error.
const lines = (...l) => l.join('\n');
const NEXTEST_FAILED_RUN = lines(NEXTEST_LOG, '     Summary [   1.0s] 3 tests run: 1 passed, 2 failed, 0 skipped', 'error: test run failed', '');
const RUSTC_FAILED_RUN = lines('error[E0425]: cannot find value `x`', '  --> crates/a/src/lib.rs:3:5', '', 'error: could not compile `a`', '', 'error: test run failed', '');

test('diagnose: nextest "error: test run failed" is no compile error and the failed tests are named', () => {
  const d = diagnose(NEXTEST_FAILED_RUN);
  assert.deepEqual(d.errors, {});
  assert.deepEqual(d.failedTests, ['the_catalog_matches_the_full_authored_inventory', 'scene::terrain::landform::tests::foo']);
});

test('attribute: a nextest failure run leads to a baseline run; a real rustc error does not', () => {
  const dir = tempDir('attr-n-');
  try {
    const log = join(dir, 'b.log');
    writeFileSync(log, NEXTEST_LOG);
    const ran = [];
    const runBaseline = (cmd) => { ran.push(cmd); return log; };
    const r = attribute({ command: { cmd: 'cargo nextest run', ...diagnose(NEXTEST_FAILED_RUN) }, runBaseline });
    assert.equal(ran.length, 1);
    assert.deepEqual([r.foreign.length, r.caused.length], [2, 0]);

    const build = diagnose(`${RUSTC_FAILED_RUN}${NEXTEST_LOG}`);
    assert.ok(build.errors['crates/a/src/lib.rs'], 'the real rustc error is kept');
    assert.equal(attribute({ command: { cmd: 'cargo nextest run', ...build }, runBaseline }), null);
    assert.equal(ran.length, 1, 'no baseline run for a build error');
  } finally { cleanup(dir); }
});

test('baselineCommand: nextest binary_id + test per failure, libtest exact filter', () => {
  assert.equal(baselineCommand('cargo nextest run -p x', diagnose(NEXTEST_LOG).failed),
    'cargo nextest run -p x -E "(binary_id(=editor::the_asset_tool_discovers_every_script) and test(=the_catalog_matches_the_full_authored_inventory)) or (binary_id(=rg-scene) and test(=scene::terrain::landform::tests::foo))"');
  const lt = [{ binary: null, test: 'a' }];
  assert.equal(baselineCommand('cargo t -p x', lt), 'cargo t -p x -- --exact a');
  assert.equal(baselineCommand('cargo t -- --nocapture', lt), 'cargo t -- --nocapture --exact a');
});

test('a baseline run that matches zero tests is unattributed, never a pass or a cause', () => {
  const command = { cmd: 'x', errors: {}, failed: diagnose(NEXTEST_LOG).failed };
  const dir = tempDir('attr-');
  try {
    const log = join(dir, 'b.log');
    writeFileSync(log, 'Starting 0 tests across 0 binaries\n');
    assert.equal(attribute({ command, runBaseline: () => log }), null);
    writeFileSync(log, NEXTEST_LOG);
    const r = attribute({ command, runBaseline: () => log });
    assert.deepEqual([r.foreign.length, r.caused.length], [2, 0]);
  } finally { cleanup(dir); }
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
