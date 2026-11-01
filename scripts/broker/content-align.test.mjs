// content-align.test.mjs — a build never links another tree's artifact (KIT-T767, KIT-T769). Real git throughout; the cargo test
// uses a one-crate workspace: the control (no alignment) judges the foreign artifact fresh, the aligned tree rebuilds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { alignSources } from './content-align.mjs';
import { prepareCheckTree } from './check-tree.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { cleanup, makeRepo, tempDir } from './testkit.mjs';

const HAS_CARGO = spawnSync('cargo', ['--version'], { shell: true }).status === 0;
const OLD_S = 1_700_000_000;
const mtimeS = (path) => Math.floor(statSync(path).mtimeMs / 1000);
const fwd = (p) => p.split(String.fromCharCode(92)).join('/');

function crate() {
  const root = makeRepo(tempDir('content-'));
  writeFileSync(join(root, 'Cargo.toml'), '[package]\nname = "probe"\nversion = "0.1.0"\nedition = "2021"\n');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'lib.rs'), 'pub fn f() -> u32 { 1 }\n');
  writeFileSync(join(root, 'src', 'other.rs'), 'pub fn g() -> u32 { 2 }\n');
  g(['add', '-A'], root);
  g(['commit', '-qm', 'crate'], root);
  for (const f of ['Cargo.toml', 'src/lib.rs', 'src/other.rs']) utimesSync(join(root, f), OLD_S, OLD_S);
  return root;
}

const worktree = (live, name) => {
  const dir = join(tempDir('content-wt-'), name);
  g(['worktree', 'add', '-q', '--detach', dir, 'HEAD'], live);
  for (const f of ['Cargo.toml', 'src/lib.rs', 'src/other.rs']) utimesSync(join(dir, f), OLD_S, OLD_S);
  return dir;
};

function check(cwd, targetDir) {
  const r = spawnSync('cargo', ['check', '--offline'], { cwd, encoding: 'utf8', env: { ...process.env, CARGO_TARGET_DIR: targetDir }, shell: true });
  assert.equal(r.status, 0, r.stderr);
  return /Checking probe/.test(r.stderr);
}

test('a file another tree changed gets a fresh mtime; a file with the same content and the files nobody changed keep theirs', () => {
  const live = crate();
  const target = tempDir('content-target-');
  try {
    const other = worktree(live, 'other');
    assert.equal(alignSources(live, target).touched, 0, 'the first build has no earlier record');
    writeFileSync(join(other, 'src', 'lib.rs'), 'pub fn f() -> u32 { 10 }\n');
    assert.equal(alignSources(other, target).touched, 1, 'the patched tree touches the file that differs from the last build');
    assert.equal(alignSources(live, target).touched, 1, 'the clean tree touches the file the patched tree built');
    assert.ok(mtimeS(join(live, 'src', 'lib.rs')) > OLD_S);
    assert.equal(mtimeS(join(live, 'src', 'other.rs')), OLD_S, 'an unchanged file keeps its mtime');
    writeFileSync(join(other, 'src', 'lib.rs'), 'pub fn f() -> u32 { 10 }\n');
    writeFileSync(join(live, 'src', 'lib.rs'), 'pub fn f() -> u32 { 10 }\n');
    alignSources(live, target);
    utimesSync(join(other, 'src', 'lib.rs'), OLD_S, OLD_S);
    assert.equal(alignSources(other, target).touched, 0, 'identical content is not touched');
    assert.equal(mtimeS(join(other, 'src', 'lib.rs')), OLD_S);
  } finally { cleanup(live); cleanup(target); }
});

test('a tree on another base commit touches the files that differ between the two commits only', () => {
  const live = crate();
  const target = tempDir('content-target-');
  try {
    const old = worktree(live, 'old');
    writeFileSync(join(live, 'src', 'lib.rs'), 'pub fn f() -> u32 { 3 }\n');
    g(['commit', '-qam', 'change lib'], live);
    for (const f of ['src/lib.rs', 'src/other.rs']) utimesSync(join(live, f), OLD_S, OLD_S);
    alignSources(live, target);
    assert.equal(alignSources(old, target).touched, 1);
    assert.ok(mtimeS(join(old, 'src', 'lib.rs')) > OLD_S);
    assert.equal(mtimeS(join(old, 'src', 'other.rs')), OLD_S);
  } finally { cleanup(live); cleanup(target); }
});

test('a submodule file edited in one tree is touched in the next tree that builds', () => {
  const t = setup();
  const target = tempDir('content-target-');
  try {
    writeFileSync(join(t.sub, 'api.txt'), 'v1\n');
    g(['add', 'api.txt'], t.sub);
    g(['commit', '-m', 'api'], t.sub);
    g(['add', 'rapid-game'], t.root);
    g(['commit', '-m', 'pin'], t.root);
    utimesSync(join(t.sub, 'api.txt'), OLD_S, OLD_S);
    alignSources(t.root, target);
    writeFileSync(join(t.sub, 'api.txt'), 'v2\n');
    assert.equal(alignSources(t.root, target).touched, 1, 'the edit itself is a difference from the last build');
    g(['checkout', '--', 'api.txt'], t.sub);
    utimesSync(join(t.sub, 'api.txt'), OLD_S, OLD_S);
    assert.equal(alignSources(t.root, target).touched, 1, 'the revert is a difference from the edited build');
    assert.ok(mtimeS(join(t.sub, 'api.txt')) > OLD_S);
  } finally { cleanup(target); t.done(); }
});

test('cargo: an artifact built from another tree patch is rebuilt, not linked, once the sources are aligned', { skip: !HAS_CARGO && 'cargo is not installed' }, () => {
  const live = crate();
  const target = tempDir('content-target-');
  try {
    const patched = worktree(live, 'patched');
    alignSources(live, target);
    assert.equal(check(live, target), true, 'the clean tree builds first');
    writeFileSync(join(patched, 'src', 'lib.rs'), 'pub fn f() -> u32 { 10 }\n');
    alignSources(patched, target);
    assert.equal(check(patched, target), true, 'the patched tree rebuilds the crate');
    utimesSync(join(live, 'src', 'lib.rs'), OLD_S, OLD_S);
    assert.equal(check(live, target), false, 'control: without alignment the clean tree links the patched build');
    alignSources(live, target);
    assert.equal(check(live, target), true, 'aligned, the clean tree rebuilds against its own source');
  } finally { cleanup(live); cleanup(target); }
});

const readFrom = (out) => `node -e "require('fs').writeFileSync('${fwd(out)}', require('fs').readFileSync('rapid-game/api.txt','utf8'))"`;

test('a check job that edits the submodule leaves the next job a clean submodule in the same check tree', () => {
  const t = setup();
  const side = tempDir('content-side-');
  try {
    t.cfg.checkTree = true;
    writeFileSync(join(t.sub, 'api.txt'), 'v1\n');
    g(['add', 'api.txt'], t.sub);
    g(['commit', '-m', 'api'], t.sub);
    g(['push', 'origin', 'main'], t.sub);
    g(['add', 'rapid-game'], t.root);
    g(['commit', '-m', 'pin'], t.root);
    const edit = '*** edit rapid-game/api.txt\n<<<<<<< SEARCH\nv1\n=======\nv2\n>>>>>>> REPLACE\n';
    const first = t.run({ ticket: 'T-1' }, edit, [readFrom(join(side, 'first.txt'))]);
    assert.equal(first.r.status, 'passed', JSON.stringify(first.r));
    assert.equal(readFileSync(join(side, 'first.txt'), 'utf8').trim(), 'v2', 'control: the job saw its own submodule edit');
    const second = t.run({ ticket: 'T-2' }, '*** write p.txt\np\n', [readFrom(join(side, 'second.txt'))]);
    assert.equal(second.r.status, 'passed', JSON.stringify(second.r));
    assert.equal(readFileSync(join(side, 'second.txt'), 'utf8').trim(), 'v1', 'the unrelated job built against the clean submodule');
    const tree = prepareCheckTree(t.cfg, t.cfg.repos[0]);
    assert.equal(g(['status', '--porcelain'], join(tree.cfg.root, 'rapid-game')), '');
  } finally { cleanup(side); t.done(); }
});
