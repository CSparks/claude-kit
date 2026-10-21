// own-writes.test.mjs — a job's own writes to tracked files outside its journal are put back (KIT-T616):
// a test-only job that rewrites a tracked file leaves the tree clean; hand dirt, staged changes and
// files dirty before the job are never touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { dirtyPaths } from './git.mjs';
import { sweepOwnWrites } from './own-writes.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';

const REWRITE = `node -e "require('fs').writeFileSync('golden.json','blessed')"`;
const read = (s, f) => readFileSync(join(s.root, f), 'utf8');

test('a test-only job that rewrites a tracked file leaves the tree as found', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'golden.json', 'original', 'add golden');
    const { job } = buildPatchJob(s.cfg, { 'no-patch': true }, '');
    writeJob(s.cfg, { ...job, commands: [REWRITE] });
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
    assert.equal(read(s, 'golden.json'), 'original');
    assert.deepEqual(dirtyPaths(s.root), []);
  } finally { s.done(); }
});

test('the sweep keeps the discarded bytes as a blob', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, 'src.txt'), 'edited');
    const [swept] = sweepOwnWrites(s.cfg, { id: 'j-1', cwd: s.root, before: [] });
    assert.equal(swept.path, 'src.txt');
    assert.equal(g(['cat-file', 'blob', swept.backup], s.root), 'edited');
    assert.equal(read(s, 'src.txt'), 'alpha\nbeta\ngamma\n');
  } finally { s.done(); }
});

test('control: a file dirty before the job, or a staged change, is left alone', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'other.txt', 'one', 'add other');
    writeFileSync(join(s.root, 'src.txt'), 'hand edit');
    writeFileSync(join(s.root, 'other.txt'), 'staged edit');
    g(['add', 'other.txt'], s.root);
    assert.deepEqual(sweepOwnWrites(s.cfg, { id: 'j-2', cwd: s.root, before: ['src.txt'] }), []);
    assert.equal(read(s, 'src.txt'), 'hand edit');
    assert.equal(read(s, 'other.txt'), 'staged edit');
  } finally { s.done(); }
});
