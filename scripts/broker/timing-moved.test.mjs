// timing-moved.test.mjs — the paths the base moved between two jobs, a moved submodule pin expanded to the paths
// that changed inside it, so a landing's rebuild is not counted as waste (KIT-D121).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cachedMoved, movedPaths } from './timing-moved.mjs';
import { setPulse } from './stall.mjs';
import { cleanup, g, makeRepo, tempDir } from './testkit.mjs';

const commit = (dir, files, message) => {
  for (const [p, text] of Object.entries(files)) { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), text); }
  g(['add', '-A'], dir);
  g(['commit', '-qm', message], dir);
  return g(['rev-parse', 'HEAD'], dir).trim();
};

test('the paths changed between two commits, and nothing for an unchanged or unknown base', () => {
  const dir = makeRepo(tempDir('moved-'));
  try {
    const a = g(['rev-parse', 'HEAD'], dir).trim();
    const b = commit(dir, { 'crates/a/src/lib.rs': 'x', 'README': 'moved' }, 'two files');
    assert.deepEqual(movedPaths(dir, a, b).sort(), ['README', 'crates/a/src/lib.rs']);
    assert.deepEqual(movedPaths(dir, b, b), []);
    assert.deepEqual(movedPaths(dir, null, b), []);
    assert.deepEqual(movedPaths(dir, 'deadbeef', b), []);
  } finally { cleanup(dir); }
});

test('a moved submodule pin becomes the paths that changed inside the submodule', () => {
  const sub = makeRepo(tempDir('moved-sub-'));
  const top = makeRepo(tempDir('moved-top-'));
  try {
    g(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'fw'], top);
    g(['commit', '-qm', 'add fw'], top);
    const before = g(['rev-parse', 'HEAD'], top).trim();
    commit(join(top, 'fw'), { 'rust/core/rg-a/src/lib.rs': 'changed' }, 'framework change');
    g(['add', 'fw'], top);
    g(['commit', '-qm', 'bump fw'], top);
    const after = g(['rev-parse', 'HEAD'], top).trim();
    assert.deepEqual(movedPaths(top, before, after), ['fw/rust/core/rg-a/src/lib.rs']);
  } finally { cleanup(top); cleanup(sub); }
});

test('cachedMoved asks git once per commit pair, beats the heartbeat on a miss, and keeps only the pairs asked for', () => {
  const dir = makeRepo(tempDir('moved-cache-'));
  const file = join(dir, '.git', 'moved-cache.json');
  const beats = [];
  setPulse(() => beats.push(1));
  try {
    const a = g(['rev-parse', 'HEAD'], dir).trim();
    const b = commit(dir, { 'crates/a/src/lib.rs': 'x' }, 'one file');
    const first = cachedMoved(file);
    assert.deepEqual(first.moved(dir, a, b), ['crates/a/src/lib.rs']);
    first.save();
    assert.equal(beats.length, 1, 'a miss beats the heartbeat');
    const second = cachedMoved(file);
    assert.deepEqual(second.moved(join(dir, 'not-a-repo'), a, b), [], 'another repo dir is another key');
    assert.deepEqual(second.moved(dir, a, b), ['crates/a/src/lib.rs'], 'a known pair is read from the file, git is not asked');
    second.save();
    assert.equal(Object.keys(JSON.parse(readFileSync(file, 'utf8'))).length, 2);
    const third = cachedMoved(file);
    third.moved(dir, a, b);
    third.save();
    assert.equal(Object.keys(JSON.parse(readFileSync(file, 'utf8'))).length, 1, 'a pair no longer asked for is dropped');
    assert.deepEqual(third.moved(dir, b, b), []);
  } finally { setPulse(null); cleanup(dir); }
});
