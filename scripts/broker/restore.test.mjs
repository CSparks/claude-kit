// restore.test.mjs — tracked build debris goes back from HEAD without a hand checkout: a submodule whose only
// change is Cargo.lock is restored at the pin step and by `broker.mjs restore --debris`; a hand edit is never
// touched; a running job blocks the command.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { restoreAllDebris, restoreLockDebris, restorePaths } from './restore.mjs';
import { recordWritten } from './written.mjs';
import { preparePins } from './pin.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const LOCK = 'Cargo.lock';
const lockText = (t) => readFileSync(join(t.sub, LOCK), 'utf8').split(String.fromCharCode(13)).join('');

function withLockDebris() {
  const t = setup();
  writeFileSync(join(t.sub, LOCK), 'version = 3\n');
  g(['add', LOCK], t.sub);
  g(['commit', '-m', 'lockfile'], t.sub);
  writeFileSync(join(t.sub, LOCK), 'version = 3\n[[package]]\nname = "rg-vehicle"\n');
  return t;
}

test('a submodule whose only change is Cargo.lock is restored from HEAD', () => {
  const t = withLockDebris();
  try {
    assert.deepEqual(restoreLockDebris(t.sub), [LOCK]);
    assert.equal(lockText(t), 'version = 3\n');
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], t.sub), '');
  } finally { t.done(); }
});

test('negative: a hand edit beside the lockfile keeps the whole checkout as it is', () => {
  const t = withLockDebris();
  try {
    writeFileSync(join(t.sub, 'api.txt'), 'hand edit\n');
    g(['add', 'api.txt'], t.sub);
    g(['commit', '-m', 'api'], t.sub);
    writeFileSync(join(t.sub, 'api.txt'), 'changed by hand\n');
    assert.deepEqual(restoreLockDebris(t.sub), []);
    assert.match(readFileSync(join(t.sub, LOCK), 'utf8'), /rg-vehicle/);
  } finally { t.done(); }
});

test('the pin step restores the lockfile debris instead of refusing the submodule', () => {
  const t = withLockDebris();
  try {
    const sha = g(['rev-parse', 'HEAD'], t.sub);
    g(['push', 'origin', 'main'], t.sub);
    const r = preparePins(t.cfg, t.root, { land: false, pins: [{ repo: 'rapid-game', sha }] });
    assert.equal(r.error, undefined, JSON.stringify(r));
    assert.equal(lockText(t), 'version = 3\n');
  } finally { t.done(); }
});

test('restorePaths: a lockfile and a broker-written file are restored, a hand edit is refused', () => {
  const t = withLockDebris();
  try {
    writeFileSync(join(t.sub, 'mine.txt'), 'a\n');
    writeFileSync(join(t.sub, 'hand.txt'), 'a\n');
    g(['add', 'mine.txt', 'hand.txt'], t.sub);
    g(['commit', '-m', 'files'], t.sub);
    writeFileSync(join(t.sub, 'mine.txt'), 'broker wrote this\n');
    writeFileSync(join(t.sub, 'hand.txt'), 'a person wrote this\n');
    recordWritten(t.cfg, t.sub, ['mine.txt'], 'j-1');
    const r = restorePaths(t.cfg, ['rapid-game/Cargo.lock', 'rapid-game/mine.txt', 'rapid-game/hand.txt', 'rapid-game/api-missing.txt']);
    assert.deepEqual(r.restored, ['rapid-game/Cargo.lock', 'rapid-game/mine.txt']);
    assert.deepEqual(r.refused.map((x) => x.path), ['rapid-game/hand.txt', 'rapid-game/api-missing.txt']);
    assert.equal(readFileSync(join(t.sub, 'hand.txt'), 'utf8'), 'a person wrote this\n');
  } finally { t.done(); }
});

test('broker.mjs restore --debris clears every submodule lockfile through the CLI', () => {
  const t = withLockDebris();
  try {
    mkdirSync(join(t.root, '.ai'), { recursive: true });
    writeFileSync(join(t.root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: super, path: ., main: main, remote: origin }\n    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }\n');
    const r = spawnSync(process.execPath, [BROKER, 'restore', '--debris', '--root', t.root], { encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /restored rapid-game\/Cargo\.lock/);
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], t.sub), '');
    assert.equal(restoreAllDebris(t.cfg).length, 0, 'nothing left');
  } finally { t.done(); }
});
