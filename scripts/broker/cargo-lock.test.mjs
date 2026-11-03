// cargo-lock.test.mjs — a Cargo.lock read once per change: the memoised reader returns the same graph until the
// file's mtime or size changes, and the reverse dependency index is built once per graph.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dependentsOf, readLock, readLockMemo } from './cargo-lock.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const LOCK = [
  '[[package]]', 'name = "app"', 'version = "0.1.0"', 'dependencies = [', ' "lib",', ']', '',
  '[[package]]', 'name = "lib"', 'version = "0.1.0"', '',
].join('\n');

test('readLockMemo returns the same graph for an unchanged file and a fresh one after it changes', () => {
  const dir = tempDir('cargo-lock-');
  const file = join(dir, 'Cargo.lock');
  try {
    writeFileSync(file, LOCK);
    const first = readLockMemo(file);
    assert.equal(readLockMemo(file), first, 'unchanged: no second parse');
    assert.deepEqual([...dependentsOf(first, ['lib'])].sort(), ['app', 'lib']);
    writeFileSync(file, `${LOCK}\n[[package]]\nname = "extra"\nversion = "0.1.0"\n`);
    const next = readLockMemo(file);
    assert.notEqual(next, first, 'changed size: parsed again');
    assert.ok(next.has('extra'));
    const same = new Date(Date.now() + 5000);
    writeFileSync(file, LOCK.replace('0.1.0', '0.2.0'));
    utimesSync(file, same, same);
    assert.notEqual(readLockMemo(file), next, 'changed mtime: parsed again');
  } finally { cleanup(dir); }
});

test('negative: a missing file is null and is not remembered; readLock itself never memoises', () => {
  const dir = tempDir('cargo-lock-none-');
  const file = join(dir, 'Cargo.lock');
  try {
    assert.equal(readLockMemo(file), null);
    writeFileSync(file, LOCK);
    assert.ok(readLockMemo(file).has('app'));
    assert.notEqual(readLock(file), readLock(file));
  } finally { cleanup(dir); }
});
