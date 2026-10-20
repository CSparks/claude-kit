// clean.test.mjs — `broker.mjs clean`: untracked leftovers go, tracked files, paths outside the
// checkout, .git and the broker home are refused; build commands run with bytecode writing off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanUntracked, pycacheDirs } from './clean.mjs';
import { buildEnv } from './prepush.mjs';
import { fixture } from './patchkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');

const withPycache = () => {
  const s = fixture();
  mkdirSync(join(s.root, 'scripts', '__pycache__'), { recursive: true });
  writeFileSync(join(s.root, 'scripts', '__pycache__', 'x.cpython-312.pyc'), 'bytes');
  mkdirSync(join(s.root, 'target', 'deep', '__pycache__'), { recursive: true });
  return s;
};

test('clean removes an untracked directory and names it', () => {
  const s = withPycache();
  try {
    const r = cleanUntracked(s.cfg, ['scripts/__pycache__']);
    assert.deepEqual(r.removed, ['scripts/__pycache__']);
    assert.equal(existsSync(join(s.root, 'scripts', '__pycache__')), false);
  } finally { s.done(); }
});

test('negative: tracked files, outside paths, .git and missing paths are refused and nothing is removed', () => {
  const s = withPycache();
  try {
    const r = cleanUntracked(s.cfg, ['src.txt', '../elsewhere', '.git', 'nope.txt']);
    assert.deepEqual(r.removed, []);
    assert.deepEqual(r.refused.map((x) => x.reason), ['tracked files live there; delete them with a patch', 'outside the checkout', 'inside .git', 'does not exist']);
    assert.equal(existsSync(join(s.root, 'src.txt')), true);
  } finally { s.done(); }
});

test('pycacheDirs finds __pycache__ outside target/ only, and the CLI --pycache removes them', () => {
  const s = withPycache();
  try {
    assert.deepEqual(pycacheDirs(s.root).map((p) => p.split(sep).join('/').split('/').slice(-2).join('/')), ['scripts/__pycache__']);
    const r = spawnSync(process.execPath, [BROKER, 'clean', '--pycache', '--root', s.root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /removed scripts\/__pycache__/);
    assert.equal(existsSync(join(s.root, 'scripts', '__pycache__')), false);
    assert.equal(existsSync(join(s.root, 'target', 'deep', '__pycache__')), true, 'target/ is the build cache, left alone');
  } finally { s.done(); }
});

test('build commands and hooks run with bytecode writing off', () => {
  const s = fixture();
  try {
    assert.equal(buildEnv(s.cfg).PYTHONDONTWRITEBYTECODE, '1');
  } finally { s.done(); }
});
