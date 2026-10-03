// prune.test.mjs — a patch that empties a folder leaves no empty folder behind after landing, and a
// check-only run restores the tree, folders included (KIT-T315).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, g, snapshot } from './patchkit.mjs';

const PASS = 'node -e "process.exit(0)"';
// Move the only file of a/b/ to c.txt: delete the old path, write the new one.
const MOVE = '*** delete a/b/only.txt\n*** write c.txt\nmoved\n';

function run(s, flags, envelope = MOVE) {
  const { job } = buildPatchJob(s.cfg, flags, envelope);
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
}
function withFolder(extra = {}) {
  const s = fixture();
  mkdirSync(join(s.root, 'a/b'), { recursive: true });
  commitOnMain(s.root, 'a/b/only.txt', 'only\n', 'folder');
  for (const [rel, text] of Object.entries(extra)) { mkdirSync(join(s.root, rel, '..'), { recursive: true }); writeFileSync(join(s.root, rel), text); }
  g(['push', 'origin', 'main'], s.root);
  return s;
}

test('a landing that moves the only file out of a/b/ leaves no a/b and no a', () => {
  const s = withFolder();
  try {
    const r = run(s, { ticket: 'T-1', title: 'move', land: true });
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(existsSync(join(s.root, 'a/b')), false);
    assert.equal(existsSync(join(s.root, 'a')), false, 'the emptied parent goes too');
    assert.equal(readFileSync(join(s.root, 'c.txt'), 'utf8'), 'moved\n');
  } finally { s.done(); }
});

test('a check-only run restores the tree byte for byte, folders included', () => {
  const s = withFolder();
  try {
    const before = snapshot(s.root);
    const r = run(s, {});
    assert.equal(r.status, 'passed');
    assert.deepEqual(snapshot(s.root), before);
    assert.equal(readFileSync(join(s.root, 'a/b/only.txt'), 'utf8'), 'only\n');
    assert.equal(existsSync(join(s.root, 'c.txt')), false);
  } finally { s.done(); }
});

test('negative: a folder with a remaining tracked file, or an untracked file, stays', () => {
  const tracked = withFolder();
  const untracked = withFolder({ 'a/b/notes.md': 'mine\n' });
  try {
    commitOnMain(tracked.root, 'a/b/other.txt', 'other\n', 'sibling');
    g(['push', 'origin', 'main'], tracked.root);
    assert.equal(run(tracked, { ticket: 'T-1', title: 'move', land: true }).status, 'landed');
    assert.equal(existsSync(join(tracked.root, 'a/b/other.txt')), true, 'folder with a remaining file stays');
    assert.equal(run(untracked, {}).status, 'passed');
    assert.equal(existsSync(join(untracked.root, 'a/b/notes.md')), true);
  } finally { tracked.done(); untracked.done(); }
});

test('the prune never reaches the repo root', () => {
  const s = fixture();
  try {
    const r = run(s, { ticket: 'T-1', title: 'drop', land: true }, '*** delete src.txt\n*** write keep.txt\nk\n');
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(existsSync(s.root), true);
    assert.equal(existsSync(join(s.root, '.git')), true);
  } finally { s.done(); }
});
