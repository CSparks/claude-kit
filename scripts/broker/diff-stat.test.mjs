// diff-stat.test.mjs — an edit inside a submodule shows in the job's diff stat as the files it changed, under the
// submodule path, so the reach of the change can place it in a crate (KIT-T801).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { diffStatOf } from './diff-stat.mjs';
import { reachOf } from './timing-reach.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const run = (cwd, ...args) => { const r = spawnSync('git', ['-c', 'protocol.file.allow=always', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
const put = (dir, p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };

function superRepo() {
  const root = tempDir('diff-stat-');
  const sub = join(root, 'origin-sub');
  mkdirSync(sub);
  run(sub, 'init', '-q');
  put(sub, 'crates/rg-physics/Cargo.toml', '[package]\nname = "rg-physics"\n');
  put(sub, 'crates/rg-physics/src/lib.rs', 'a\n');
  run(sub, 'add', '-A');
  run(sub, 'commit', '-qm', 'sub');
  const sup = join(root, 'super');
  mkdirSync(sup);
  run(sup, 'init', '-q');
  put(sup, 'top.rs', 'x\n');
  run(sup, 'add', '-A');
  run(sup, 'commit', '-qm', 'init');
  run(sup, 'submodule', 'add', '-q', sub, 'rapid-game');
  run(sup, 'commit', '-qm', 'add sub');
  return { root, sup };
}

test('a file edited inside a submodule appears under the submodule path; a super-repo edit stays as it is', () => {
  const { root, sup } = superRepo();
  try {
    put(sup, 'rapid-game/crates/rg-physics/src/lib.rs', 'a\nb\n');
    put(sup, 'top.rs', 'x\ny\n');
    const stat = diffStatOf(sup);
    assert.match(stat, /^\s*rapid-game\/crates\/rg-physics\/src\/lib\.rs\s+\|/m, 'the submodule edit is placed by file');
    assert.match(stat, /^\s*top\.rs\s+\|/m);
    assert.ok(!/^\s*rapid-game\s+\|/m.test(stat), 'the one-line submodule entry is replaced');
  } finally { cleanup(root); }
});

test('reach places a submodule edit in its crate once the stat is expanded', () => {
  const { root, sup } = superRepo();
  try {
    put(sup, 'rapid-game/crates/rg-physics/src/lib.rs', 'a\nb\n');
    put(sup, 'rapid-game/Cargo.lock', '[[package]]\nname = "rg-physics"\nversion = "0.1.0"\n');
    const expanded = reachOf([{ diffStat: diffStatOf(sup) }], [sup]);
    const folded = reachOf([{ diffStat: ' rapid-game | 0\n' }], [sup]);
    assert.ok(expanded.known && expanded.reach.has('rg-physics'));
    assert.equal(folded.reach.size, 0, 'control: the folded one-line entry reaches nothing');
  } finally { cleanup(root); }
});

test('a clean tree and a path-limited stat behave as git does', () => {
  const { root, sup } = superRepo();
  try {
    assert.equal(diffStatOf(sup), '');
    put(sup, 'top.rs', 'x\ny\n');
    put(sup, 'rapid-game/crates/rg-physics/src/lib.rs', 'a\nb\n');
    const limited = diffStatOf(sup, ['top.rs']);
    assert.match(limited, /top\.rs/);
    assert.ok(!/rapid-game/.test(limited));
  } finally { cleanup(root); }
});
