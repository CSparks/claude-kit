// timing-moved.test.mjs — the paths the base moved between two jobs, a moved submodule pin expanded to the paths
// that changed inside it, so a landing's rebuild is not counted as waste (KIT-D121).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { movedPaths } from './timing-moved.mjs';
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
