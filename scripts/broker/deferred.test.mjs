// deferred.test.mjs — foreign failures are deferred and re-checked while idle (KIT-T271):
// a pass drops the entry, a failure on a clean tree files a bug, and status lists the rest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listDeferred, deferredLines } from './deferred.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';

// Fails while flag.txt reads 'bad' (always=false) or unconditionally (always=true).
const suite = (always) => {
  const code = `const bad=${always}||require('fs').readFileSync('flag.txt','utf8').includes('bad');if(bad){console.log('test t_flag ... FAILED');console.log('---- t_flag stdout ----');console.log('flag is bad')}else console.log('test t_flag ... ok');process.exit(bad?1:0)`;
  return `node -e "${code}"`;
};

function deferOne(always) {
  const s = fixture();
  commitOnMain(s.root, 'flag.txt', 'ok\n', 'flag');
  writeFileSync(join(s.root, 'flag.txt'), 'bad\n'); // a live hand edit
  const { job } = buildPatchJob(s.cfg, {}, '*** write marker.txt\nm\n');
  writeJob(s.cfg, { ...job, commands: [suite(always)] });
  processOnce(s.cfg);
  return { s, id: job.id };
}

test('a foreign failure is deferred with its command, job, reason and dirty paths', () => {
  const { s, id } = deferOne(false);
  try {
    assert.equal(readResult(s.cfg, id).status, 'passed');
    const [e] = listDeferred(s.cfg);
    assert.deepEqual([e.test, e.job, e.dirty, e.repo], ['t_flag', id, ['flag.txt'], 'app']);
    assert.match(e.reason, /flag is bad/);
    assert.match(deferredLines(s.cfg)[0], /t_flag.*flag\.txt/);
    assert.equal(processOnce(s.cfg).deferred.dropped.length, 0, 'nothing changed: not re-run');
  } finally { s.done(); }
});

test('a deferred test passing after its dirty file is reverted is dropped', () => {
  const { s } = deferOne(false);
  try {
    g(['checkout', '--', 'flag.txt'], s.root);
    const r = processOnce(s.cfg, { fileBug: () => assert.fail('no bug expected') });
    assert.deepEqual(r.deferred.dropped, ['t_flag']);
    assert.deepEqual(listDeferred(s.cfg), []);
  } finally { s.done(); }
});

test('a deferred test still failing on a clean tree files a bug and leaves the list', () => {
  const { s } = deferOne(true);
  try {
    g(['checkout', '--', 'flag.txt'], s.root);
    const bugs = [];
    const r = processOnce(s.cfg, { fileBug: (b) => bugs.push(b) });
    assert.deepEqual(r.deferred.filed, ['t_flag']);
    assert.equal(bugs.length, 1);
    assert.match(bugs[0].text, /t_flag.*clean committed tree.*node -e.*flag is bad/s);
    assert.deepEqual(listDeferred(s.cfg), []);
  } finally { s.done(); }
});

test('a deferred test still failing while its dirty file is dirty stays on the list', () => {
  const { s } = deferOne(false);
  try {
    writeFileSync(join(s.root, 'other.txt'), 'x\n');
    g(['add', 'other.txt'], s.root);
    g(['commit', '-m', 'head moves', '--', 'other.txt'], s.root); // flag.txt stays dirty
    const r = processOnce(s.cfg, { fileBug: () => assert.fail('no bug expected') });
    assert.deepEqual(r.deferred.kept, ['t_flag']);
    assert.equal(listDeferred(s.cfg).length, 1);
  } finally { s.done(); }
});

// The idle re-check runs cargo in the live tree; it must leave every Cargo.lock as found.
test('a deferred re-check whose command rewrites Cargo.lock leaves it byte-identical', () => {
  const rewrite = "require('fs').writeFileSync('Cargo.lock','resolved');";
  const s = fixture();
  try {
    commitOnMain(s.root, 'Cargo.lock', 'base\n', 'lock');
    commitOnMain(s.root, 'flag.txt', 'ok\n', 'flag');
    writeFileSync(join(s.root, 'flag.txt'), 'bad\n');
    const { job } = buildPatchJob(s.cfg, {}, '*** write marker.txt\nm\n');
    writeJob(s.cfg, { ...job, commands: [suite(false).replace('node -e "', `node -e "${rewrite}`)] });
    processOnce(s.cfg);
    assert.equal(listDeferred(s.cfg).length, 1);
    g(['checkout', '--', 'flag.txt'], s.root);
    const r = processOnce(s.cfg, { fileBug: () => assert.fail('no bug expected') });
    assert.deepEqual(r.deferred.dropped, ['t_flag']);
    assert.equal(readFileSync(join(s.root, 'Cargo.lock'), 'utf8'), 'base\n');
    assert.equal(g(['status', '--porcelain', '--', 'Cargo.lock'], s.root), '');
  } finally { s.done(); }
});
