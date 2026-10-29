// mtime-align.mjs — a fresh check-tree worktree takes the live tree's file mtimes, so cargo does not rebuild the workspace there.
// Real git and real cargo (a one-crate workspace): the control worktree WITHOUT the alignment rebuilds, the aligned one does not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { alignMtimes } from './mtime-align.mjs';
import { cleanup, g, makeRepo, tempDir } from './testkit.mjs';

const HAS_CARGO = spawnSync('cargo', ['--version'], { shell: true }).status === 0;
const OLD_S = 1_700_000_000;

function crate() {
  const root = makeRepo(tempDir('align-'));
  writeFileSync(join(root, 'Cargo.toml'), '[package]\nname = "probe"\nversion = "0.1.0"\nedition = "2021"\n');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'lib.rs'), 'pub fn f() -> u32 { 1 }\n');
  writeFileSync(join(root, 'notes.txt'), 'live\n');
  g(['add', '-A'], root);
  g(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'crate'], root);
  return root;
}

const worktree = (live, name) => {
  const dir = join(tempDir('align-wt-'), name);
  g(['worktree', 'add', '-q', '--detach', dir, 'HEAD'], live);
  return dir;
};

function check(cwd, targetDir) {
  const r = spawnSync('cargo', ['check', '--offline'], { cwd, encoding: 'utf8', env: { ...process.env, CARGO_TARGET_DIR: targetDir }, shell: true });
  assert.equal(r.status, 0, r.stderr);
  return /Checking probe/.test(r.stderr);
}

test('unmodified files take the live mtime; a modified file and a size mismatch keep their fresh stamp', () => {
  const live = crate();
  try {
    utimesSync(join(live, 'src', 'lib.rs'), OLD_S, OLD_S);
    utimesSync(join(live, 'Cargo.toml'), OLD_S, OLD_S);
    utimesSync(join(live, 'notes.txt'), OLD_S, OLD_S);
    writeFileSync(join(live, 'notes.txt'), 'live and edited by hand\n');
    utimesSync(join(live, 'notes.txt'), OLD_S, OLD_S);
    const tree = worktree(live, 'tree');
    const aligned = alignMtimes(live, tree);
    assert.ok(aligned >= 2, 'at least Cargo.toml and src/lib.rs');
    assert.equal(Math.floor(statSync(join(tree, 'src', 'lib.rs')).mtimeMs / 1000), OLD_S);
    assert.notEqual(Math.floor(statSync(join(tree, 'notes.txt')).mtimeMs / 1000), OLD_S, 'control: the modified file keeps its fresh stamp');
  } finally { cleanup(live); }
});

test('cargo rebuilds a fresh worktree sharing the live tree target dir; an aligned one is already up to date', { skip: !HAS_CARGO && 'cargo is not installed' }, () => {
  const live = crate();
  const target = tempDir('align-target-');
  try {
    assert.equal(check(live, target), true, 'the live tree builds first');
    const stamp = Date.now() / 1000 + 5;
    const cold = worktree(live, 'cold');
    for (const f of ['Cargo.toml', 'src/lib.rs']) utimesSync(join(cold, f), stamp, stamp);
    assert.equal(check(cold, target), true, 'control: a worktree with fresh mtimes recompiles the crate');
    const warm = worktree(live, 'warm');
    for (const f of ['Cargo.toml', 'src/lib.rs']) utimesSync(join(warm, f), stamp, stamp);
    alignMtimes(live, warm);
    assert.equal(check(warm, target), false, 'an aligned worktree compiles nothing');
  } finally { cleanup(live); cleanup(target); }
});
