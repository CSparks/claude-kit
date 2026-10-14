// dirdelete.test.mjs — a patch that deletes a whole directory (KIT-T477): the delete expands to
// the tracked files under it, a check-only run restores them byte for byte, a landing commits
// each removal, and a crash journal holding a directory entry (the shape that killed the daemon)
// recovers without touching that directory.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture, readInflight, recoverInflight, restore } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { ensureDirs, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, snapshot } from './patchkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const DIR = 'assets/candidates';

const withDir = () => {
  const s = fixture();
  mkdirSync(join(s.root, DIR, 'deep'), { recursive: true });
  writeFileSync(join(s.root, DIR, 'a.wav'), Buffer.from([0, 255, 1, 254]));
  writeFileSync(join(s.root, DIR, 'deep', 'b.txt'), 'b\n');
  g(['add', '-A', 'assets'], s.root);
  g(['commit', '-m', 'candidates'], s.root);
  g(['push', 'origin', 'main'], s.root);
  return s;
};

const submit = (s, flags) => {
  const { job, result, error } = buildPatchJob(s.cfg, flags, `*** delete ${DIR}\n`);
  assert.ok(job, JSON.stringify(result || error));
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return { job, r: readResult(s.cfg, job.id) };
};

test('a check-only directory delete passes and restores every file under it', () => {
  const s = withDir();
  try {
    const before = snapshot(s.root);
    const { r } = submit(s, {});
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.deepEqual(snapshot(s.root), before);
    assert.equal(g(['status', '--porcelain', '--', 'assets'], s.root), '');
  } finally { s.done(); }
});

test('a landed directory delete commits each tracked file removal and leaves no directory', () => {
  const s = withDir();
  try {
    const { r } = submit(s, { land: true, ticket: 'T-1', title: 'drop candidates' });
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['ls-tree', '-r', '--name-only', 'HEAD', '--', DIR], s.root), '');
    assert.equal(existsSync(join(s.root, DIR)), false);
    assert.equal(g(['status', '--porcelain', '--', 'assets'], s.root), '');
  } finally { s.done(); }
});

test('crash recovery: a journal entry naming a directory (old capture) is left alone, files are restored', () => {
  const s = withDir();
  try {
    const before = snapshot(s.root);
    ensureDirs(s.cfg);
    capture(s.cfg, { id: 'crash', cwd: s.root, paths: ['src.txt', DIR] });
    writeFileSync(join(s.root, 'src.txt'), 'torn\n');
    assert.deepEqual(restore(s.cfg, readInflight(s.cfg)), [], 'no entry failed and the directory was not touched');
    assert.deepEqual(snapshot(s.root), before);
    capture(s.cfg, { id: 'crash', cwd: s.root, paths: [DIR, 'src.txt'] });
    writeFileSync(join(s.root, 'src.txt'), 'torn\n');
    assert.deepEqual(recoverInflight(s.cfg), { id: 'crash', resume: null }, 'the daemon start path recovers');
    assert.deepEqual(snapshot(s.root), before, 'the tree is back at HEAD');
    assert.equal(recoverInflight(s.cfg), null, 'journal cleared');
  } finally { s.done(); }
});

test('negative: a file journalled as absent is still removed on recovery', () => {
  const s = withDir();
  try {
    const before = snapshot(s.root);
    ensureDirs(s.cfg);
    capture(s.cfg, { id: 'crash', cwd: s.root, paths: ['made/by/patch.txt'] });
    mkdirSync(join(s.root, 'made', 'by'), { recursive: true });
    writeFileSync(join(s.root, 'made', 'by', 'patch.txt'), 'x\n');
    recoverInflight(s.cfg);
    assert.equal(existsSync(join(s.root, 'made')), false, 'the created file and its empty dirs are gone');
    assert.deepEqual(snapshot(s.root), before);
  } finally { s.done(); }
});
