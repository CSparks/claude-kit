// patch.test.mjs — the patch queue (KIT-T276 L2) against real git fixtures: stdin envelope
// submit without a branch, content-addressed apply, stale reporting, and the check-only restore
// journal including a simulated crash.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dryRun } from './apply.mjs';
import { diagnose } from './diagnose.mjs';
import { EnvelopeError, parseEnvelope } from './envelope.mjs';
import { capture, recoverInflight } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { SHOW, commitOnMain, envelope, fixture, g, snapshot } from './patchkit.mjs';
const SUBMIT = join(import.meta.dirname, 'submit.mjs');
test('envelope: edit blocks, write, delete parse in order; malformed input names the line', () => {
  const ops = parseEnvelope(`*** edit a.rs\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nx\n=======\n>>>>>>> REPLACE\n*** write b.rs\nfn b() {}\n\n*** delete c.rs\n`);
  assert.deepEqual(ops.map((o) => o.kind), ['edit', 'edit', 'write', 'delete']);
  assert.deepEqual([ops[0].search, ops[0].replace, ops[1].replace], ['old', 'new', '']);
  assert.equal(ops[2].content, 'fn b() {}\n');
  assert.throws(() => parseEnvelope('*** edit a.rs\nnonsense\n'), EnvelopeError);
  assert.throws(() => parseEnvelope('*** edit a.rs\n<<<<<<< SEARCH\nx\n'), /missing/);
});

test('dryRun: exactly-once match, ambiguous, not-found, create-exists', () => {
  const read = (p) => ({ 'a.txt': 'one\ntwo\ntwo\n', 'b.txt': 'solo\n' })[p] ?? null;
  const ok = dryRun([{ kind: 'edit', path: 'b.txt', search: 'solo', replace: 'duo' }], read);
  assert.equal(ok.files.get('b.txt').text, 'duo\n');
  const bad = dryRun([
    { kind: 'edit', path: 'a.txt', search: 'two', replace: 'x' },
    { kind: 'edit', path: 'a.txt', search: 'zzz', replace: 'x' },
    { kind: 'write', path: 'b.txt', content: 'x' },
    { kind: 'edit', path: 'nope.txt', search: 'x', replace: 'y' },
  ], read);
  assert.deepEqual(bad.stale.map((s) => s.reason), ['ambiguous x2', 'not-found', 'create-exists', 'not-found']);
});

test('submit on stdin without --branch queues a patch job', () => {
  const s = fixture();
  try {
    const r = spawnSync(process.execPath, [SUBMIT, '--root', s.root, '--ticket', 'T-1', '--title', 'beta', '--test', SHOW], {
      input: envelope(['beta', 'BETA']), encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    const [job] = listQueue(s.cfg);
    assert.equal(job.id, r.stdout.trim());
    assert.equal(job.base, g(['rev-parse', 'HEAD'], s.root));
    assert.ok(job.files['src.txt'], 'touched file blob sha recorded');
    assert.equal(job.branch, undefined);
  } finally { s.done(); }
});

test('moved base with an intact block applies; the tree is restored afterwards', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-2' }, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    commitOnMain(s.root, 'src.txt', 'ALPHA\nbeta\ngamma\n', 'move base');
    const before = snapshot(s.root);
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'passed');
    assert.equal(r.phase, 'run');
    assert.equal(r.commands[0].logTail.join('\n'), 'ALPHA\nBETA\ngamma', 'patch applied on the moved text');
    assert.match(r.diffStat, /src\.txt/);
    assert.deepEqual(snapshot(s.root), before);
  } finally { s.done(); }
});

test('a missing block is stale with the commits since base and a current excerpt', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    commitOnMain(s.root, 'src.txt', 'alpha\nbeet\ngamma\n', 'rewrite beta');
    const sha = g(['rev-parse', '--short', 'HEAD'], s.root);
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'stale');
    assert.equal(r.stale[0].reason, 'not-found');
    assert.ok(r.stale[0].since.some((l) => l.startsWith(sha)), 'commit since base listed');
    assert.equal(r.head, g(['rev-parse', 'HEAD'], s.root));
  } finally { s.done(); }
});

test('submit dry run misses return stale immediately and never queue', () => {
  const s = fixture();
  try {
    const out = buildPatchJob(s.cfg, { revises: 'j-old' }, envelope(['absent text', 'x']));
    assert.equal(out.result.status, 'stale');
    assert.equal(out.result.phase, 'submit-dryrun');
    assert.match(out.result.stale[0].excerpt, /alpha/);
    assert.equal(listQueue(s.cfg).length, 0);
    const r = spawnSync(process.execPath, [SUBMIT, '--root', s.root], { input: envelope(['absent text', 'x']), encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).status, 'stale');
  } finally { s.done(); }
});

test('revises bumps the revision', () => {
  const s = fixture();
  try {
    const first = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA'])).job;
    writeJob(s.cfg, first);
    const second = buildPatchJob(s.cfg, { revises: first.id }, envelope(['gamma', 'GAMMA'])).job;
    assert.deepEqual([first.revision, second.revision, second.revises], [1, 2, first.id]);
  } finally { s.done(); }
});

test('check-only run restores byte for byte, including created files and a crash mid-run', () => {
  const s = fixture();
  try {
    const env = `${envelope(['beta', 'BETA'])}*** write deep/new/file.txt\nhi\n`;
    const { job } = buildPatchJob(s.cfg, {}, env);
    writeJob(s.cfg, job);
    const before = snapshot(s.root);
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
    assert.deepEqual(snapshot(s.root), before);
    assert.equal(existsSync(join(s.root, 'deep')), false, 'created directories pruned');

    const journal = capture(s.cfg, { id: 'crash', cwd: s.root, paths: ['src.txt', 'deep/new/file.txt'] });
    writeFileSync(join(s.root, 'src.txt'), 'torn\n');
    mkdirSync(join(s.root, 'deep/new'), { recursive: true });
    writeFileSync(join(s.root, 'deep/new/file.txt'), 'torn\n');
    assert.ok(journal.entries.length);
    assert.equal(recoverInflight(s.cfg), 'crash');
    assert.deepEqual(snapshot(s.root), before);
    assert.equal(recoverInflight(s.cfg), null, 'journal cleared');
  } finally { s.done(); }
});

test('diagnose: rustc blocks keyed by file, failed test names', () => {
  const d = diagnose('running 2 tests\ntest a::b ... FAILED\ntest a::c ... ok\n\nerror[E0425]: cannot find value `x`\n  --> crates/a/src/lib.rs:3:5\n   |\n3  |     x\n\nerror: aborting\n');
  assert.deepEqual(d.failedTests, ['a::b']);
  assert.equal(d.errors['crates/a/src/lib.rs'].length, 1);
  assert.ok(d.errors['(unlocated)']);
});
