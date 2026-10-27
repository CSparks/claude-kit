// binary.test.mjs — a patch envelope carries binary files (KIT-T650): `*** write-binary <path>` holds
// the base64 of the bytes; a green landing commits them byte for byte, a check-only run restores the
// tree, a tracked binary is replaced whole and never edited.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dryRun } from './apply.mjs';
import { EnvelopeError, parseEnvelope } from './envelope.mjs';
import { greenKey } from './green.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, originSha, snapshot } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x0d, 0x0a, 0xc8, 0x00]);
const GLB = Buffer.from([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00, 0xff, 0xfe, 0x0a, 0x0d]);
const wrap = (bytes) => bytes.toString('base64').match(/.{1,16}/g).join('\n');
const binaryEnvelope = (path, bytes) => `*** write-binary ${path}\n${wrap(bytes)}\n`;

const submit = (s, flags, text, extra = {}) => {
  const { job, result, error } = buildPatchJob(s.cfg, flags, text);
  assert.ok(job, JSON.stringify(result || error));
  writeJob(s.cfg, { ...job, ...extra });
  processOnce(s.cfg);
  return { job, r: readResult(s.cfg, job.id) };
};

test('envelope: a write-binary op carries the joined base64 of its lines, beside text ops', () => {
  const ops = parseEnvelope(`*** write a.txt\nhi\n${binaryEnvelope('art/x.png', PNG)}*** delete b.txt\n`);
  assert.deepEqual(ops.map((o) => o.kind), ['write', 'write-binary', 'delete']);
  assert.deepEqual(Buffer.from(ops[1].base64, 'base64'), PNG);
});

test('envelope: a write-binary with no lines, or a line that is not base64, is refused naming the path', () => {
  assert.throws(() => parseEnvelope('*** write-binary a.png\n*** delete b.txt\n'), /write-binary a\.png" has no base64/);
  assert.throws(() => parseEnvelope('*** write-binary a.png\nnot base64 at all!\n'), (e) => e instanceof EnvelopeError && /not base64/.test(e.message));
});

test('dryRun: write-binary creates, replaces a tracked file, refuses an untracked collision; an edit of binary bytes is stale', () => {
  const read = (p) => ({ 'old.glb': 'tracked bytes' })[p] ?? null;
  const op = (path) => ({ kind: 'write-binary', path, base64: GLB.toString('base64') });
  const made = dryRun([op('new.glb'), op('old.glb')], read);
  assert.ok(made.ok);
  assert.deepEqual(made.files.get('new.glb').text, GLB);
  assert.deepEqual(made.files.get('old.glb').text, GLB);
  assert.deepEqual(dryRun([op('loose.glb')], read, { onDisk: (p) => p === 'loose.glb' }).stale.map((s) => s.reason), ['create-exists']);
  const edit = dryRun([op('new.glb'), { kind: 'edit', path: 'new.glb', search: 'gl', replace: 'GL' }], read);
  assert.deepEqual(edit.stale.map((s) => s.reason), ['binary-file']);
});

test('green key: two different binaries are two different keys, the same bytes one', () => {
  const key = (bytes) => greenKey({ repo: 'app', pre: 'tree', commands: [], files: new Map([['a.glb', { text: bytes }]]) });
  assert.equal(key(GLB), key(Buffer.from(GLB)));
  assert.notEqual(key(GLB), key(PNG));
});

test('a green landing commits the binary byte for byte and pushes it', () => {
  const s = fixture();
  try {
    const { r } = submit(s, { ticket: 'T-9', title: 'add art', land: true }, `${binaryEnvelope('art/x.png', PNG)}*** write notes.txt\nhi\n`, { commands: [PASS] });
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(readFileSync(join(s.root, 'art', 'x.png')), PNG);
    assert.deepEqual(g(['show', '--name-only', '--pretty=format:', 'HEAD'], s.root).split('\n').filter(Boolean).sort(), ['art/x.png', 'notes.txt']);
    assert.equal(g(['rev-parse', 'HEAD:art/x.png'], s.root), g(['hash-object', '--no-filters', join(s.root, 'art', 'x.png')], s.root), 'the committed blob is the file');
    assert.equal(g(['cat-file', '-s', 'HEAD:art/x.png'], s.root), String(PNG.length));
    assert.equal(originSha(s.bare, s.root), r.landed.sha, 'pushed');
  } finally { s.done(); }
});

test('a landing replaces a tracked binary whole', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, 'a.glb'), PNG);
    g(['add', 'a.glb'], s.root);
    g(['commit', '-m', 'add glb'], s.root);
    g(['push', 'origin', 'main'], s.root);
    const { r } = submit(s, { ticket: 'T-9', title: 'new glb', land: true }, binaryEnvelope('a.glb', GLB), { commands: [PASS] });
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(readFileSync(join(s.root, 'a.glb')), GLB);
    assert.equal(g(['cat-file', '-s', 'HEAD:a.glb'], s.root), String(GLB.length));
  } finally { s.done(); }
});

test('negative: a check-only run with a binary leaves the tree as it found it', () => {
  const s = fixture();
  try {
    const before = snapshot(s.root);
    const { r } = submit(s, { ticket: 'T-9', title: 'peek' }, binaryEnvelope('art/x.png', PNG), { commands: [PASS] });
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.deepEqual(snapshot(s.root), before);
  } finally { s.done(); }
});

test('negative: a write-binary onto an untracked file already on disk is stale at submit and writes nothing', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, 'loose.png'), 'mine');
    const out = buildPatchJob(s.cfg, { ticket: 'T-9', title: 'clash', land: true }, binaryEnvelope('loose.png', PNG));
    assert.equal(out.result.status, 'stale');
    assert.equal(readFileSync(join(s.root, 'loose.png'), 'utf8'), 'mine');
  } finally { s.done(); }
});

const SUBMIT = join(import.meta.dirname, 'submit.mjs');
const cli = (s, args) => spawnSync(process.execPath, [SUBMIT, '--root', s.root, '--ticket', 'T-1', '--title', 'art', ...args], {
  input: '', cwd: s.root, encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' },
});

test('submit --binary <path>=<file> queues a write-binary op with the bytes of the file, no stdin envelope', () => {
  const s = fixture();
  const srcDir = tempDir('binary-src-');
  try {
    const src = join(srcDir, 'car.glb');
    writeFileSync(src, GLB);
    const r = cli(s, ['--binary', `art/car.glb=${src}`, '--test', PASS]);
    assert.equal(r.status, 0, r.stderr);
    const [job] = listQueue(s.cfg);
    assert.deepEqual(job.ops.map((o) => [o.kind, o.path]), [['write-binary', 'art/car.glb']]);
    assert.deepEqual(Buffer.from(job.ops[0].base64, 'base64'), GLB);
  } finally { s.done(); cleanup(srcDir); }
});

test('negative: submit --binary refuses a bad spec and a missing file before queueing anything', () => {
  const s = fixture();
  try {
    const bad = cli(s, ['--binary', 'no-equals-sign']);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /wants <dest>=<file>/);
    const missing = cli(s, ['--binary', 'art/x.glb=does-not-exist.glb']);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /cannot read/);
    assert.equal(listQueue(s.cfg).length, 0);
  } finally { s.done(); }
});
