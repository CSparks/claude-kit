// known-red.test.mjs — compile errors main already has (KIT-T482 item 5): proved once against the
// pre-patch tree, kept per tree state, their target left out of the rerun, and never charged to
// the patch. A compile error in the patch's own file, or one the pre-patch tree does not have,
// still fails the job (negative controls).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { treeState } from './cache.mjs';
import { normalizeBroker } from './config.mjs';
import { exclude, knownRed } from './known-red.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

test('exclude: check-like commands keep going; test commands drop a broken test or bin target', () => {
  assert.equal(exclude('cargo check --offline --workspace --all-targets', ['crates/a/tests/x.rs']), 'cargo check --keep-going --offline --workspace --all-targets');
  assert.equal(exclude('cargo nextest run -p game --lib --test x --test y', ['crates/game/tests/x.rs']), 'cargo nextest run -p game --lib --test y');
  assert.equal(exclude('cargo test -p game --test x', ['crates/game/tests/x.rs']), '', 'nothing selected is left');
  assert.equal(exclude('cargo test -p game --lib', ['crates/game/src/lib.rs']), null, 'a library file cannot be left out');
  assert.equal(exclude('cargo check --keep-going', ['a.rs']), null, 'already keeping going');
});

// A fake `cargo` first on PATH: it prints a rustc error for every file holding BROKEN, and one in
// theirs.txt when new-a.txt holds BREAKS_THEIRS (exit 101), and counts its runs, so a test sees
// the builds a known-red tree costs.
const FAKE_CARGO = (runs) => [
  "import fs from 'node:fs';",
  `fs.appendFileSync(${JSON.stringify(runs)}, 'x');`,
  'let bad = 0;',
  "const say = (f) => { console.log(`error[E0425]: cannot find value\\n --> ${f}:1:1\\n`); bad = 1; };",
  "const has = (f, word) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(word);",
  "for (const f of ['theirs.txt', 'mine.txt']) if (has(f, 'BROKEN')) say(f);",
  "if (has('new-a.txt', 'BREAKS_THEIRS')) say('theirs.txt');",
  'process.exit(bad ? 101 : 0);',
].join('\n');

function redFixture() {
  const s = fixture();
  const bin = tempDir('known-red-bin-');
  const runs = join(bin, 'runs');
  const script = join(bin, 'cargo.mjs');
  writeFileSync(script, FAKE_CARGO(runs));
  if (process.platform === 'win32') writeFileSync(join(bin, 'cargo.cmd'), `@node "${script}" %*\r\n`);
  else writeFileSync(join(bin, 'cargo'), `#!/bin/sh\nnode "${script}" "$@"\n`, { mode: 0o755 });
  const path = process.env.PATH;
  process.env.PATH = bin + delimiter + path;
  writeFileSync(join(s.root, 'mine.txt'), 'mine base\n');
  g(['add', 'mine.txt'], s.root);
  commitOnMain(s.root, 'theirs.txt', 'BROKEN on main\n', 'main is red');
  g(['push', 'origin', 'main'], s.root);
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], batch: 1 });
  const builds = () => (existsSync(runs) ? readFileSync(runs, 'utf8').length : 0);
  const job = (file, text, land = true) => {
    const { job: j } = buildPatchJob(s.cfg, { ticket: 'T-1', title: `edit ${file}`, land }, `*** write ${file}\n${text}\n`);
    return writeJob(s.cfg, { ...j, commands: ['cargo check --workspace'] });
  };
  return { s, job, builds, done: () => { process.env.PATH = path; s.done(); cleanup(bin); } };
}

test('a compile error main already has is proved once and the patch lands; the list is kept per tree state', () => {
  const t = redFixture();
  try {
    const tree = treeState(t.s.cfg, t.s.root);
    const first = t.job('new-a.txt', 'a');
    processOnce(t.s.cfg);
    const r = readResult(t.s.cfg, first.id);
    assert.equal(r.status, 'landed', JSON.stringify(r.commands.map((c) => c.knownRed)));
    assert.match(r.commands[0].knownRed.note, /known red at \w+: theirs\.txt fail\(s\) without the patch; re-ran without it: green/);
    assert.equal(r.commands[0].knownRed.rerun, 'cargo check --keep-going --workspace');
    assert.equal(t.builds(), 3, 'the patched run, one baseline, one rerun');
    assert.deepEqual(knownRed(t.s.cfg, tree).files, ['theirs.txt']);
    assert.equal(knownRed(t.s.cfg, treeState(t.s.cfg, t.s.root)), null, 'the landing moved HEAD: a new state starts a new list');
  } finally { t.done(); }
});

test('a second job on the same tree state skips the baseline build', () => {
  const t = redFixture();
  try {
    t.job('new-a.txt', 'a', false);
    processOnce(t.s.cfg);
    const after = t.builds();
    const second = t.job('new-b.txt', 'b', false);
    processOnce(t.s.cfg);
    assert.equal(readResult(t.s.cfg, second.id).status, 'passed');
    assert.equal(t.builds() - after, 2, 'the patched run and the rerun; the known-red list answered the baseline');
  } finally { t.done(); }
});

test('negative control: a compile error in the patch\'s own file fails the job', () => {
  const t = redFixture();
  try {
    const { job } = buildPatchJob(t.s.cfg, { ticket: 'T-1', title: 'break mine', land: true }, '*** edit mine.txt\n<<<<<<< SEARCH\nmine base\n=======\nBROKEN by the patch\n>>>>>>> REPLACE\n');
    writeJob(t.s.cfg, { ...job, commands: ['cargo check --workspace'] });
    processOnce(t.s.cfg);
    const r = readResult(t.s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.equal(r.commands[0].knownRed, undefined);
  } finally { t.done(); }
});

test('negative control: an error the pre-patch tree does not have fails the job, even in a file the patch did not touch', () => {
  const t = redFixture();
  try {
    writeFileSync(join(t.s.root, 'theirs.txt'), 'fixed\n');
    g(['commit', '-am', 'main fixed'], t.s.root);
    g(['push', 'origin', 'main'], t.s.root);
    const job = t.job('new-a.txt', 'BREAKS_THEIRS');
    processOnce(t.s.cfg);
    const r = readResult(t.s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.deepEqual(Object.keys(r.commands[0].errors), ['theirs.txt']);
    assert.equal(r.commands[0].knownRed, undefined, 'the pre-patch tree is green there: the error is the patch\'s');
  } finally { t.done(); }
});

test('after a landing the list carries over to the new HEAD while the broken file and its error are unchanged', () => {
  const t = redFixture();
  try {
    t.job('new-a.txt', 'a');
    processOnce(t.s.cfg);
    const after = t.builds();
    const second = t.job('new-b.txt', 'b');
    processOnce(t.s.cfg);
    assert.equal(readResult(t.s.cfg, second.id).status, 'landed');
    assert.equal(t.builds() - after, 2, 'no baseline on the new HEAD: the patched run and the rerun');
  } finally { t.done(); }
});

test('negative control: a broken file that changed since the list was made needs a fresh baseline', () => {
  const t = redFixture();
  try {
    t.job('new-a.txt', 'a');
    processOnce(t.s.cfg);
    writeFileSync(join(t.s.root, 'theirs.txt'), 'BROKEN differently\n');
    g(['commit', '-am', 'theirs changed'], t.s.root);
    g(['push', 'origin', 'main'], t.s.root);
    const after = t.builds();
    t.job('new-b.txt', 'b');
    processOnce(t.s.cfg);
    assert.equal(t.builds() - after, 3, 'the patched run, a baseline, the rerun');
  } finally { t.done(); }
});

test('a train on a red main: the foreign error is left out once and every member lands', () => {
  const t = redFixture();
  try {
    t.s.cfg = { ...t.s.cfg, batch: 8 };
    const a = t.job('new-a.txt', 'a');
    const b = t.job('new-b.txt', 'b');
    processOnce(t.s.cfg);
    assert.deepEqual([readResult(t.s.cfg, a.id).status, readResult(t.s.cfg, b.id).status], ['landed', 'landed']);
    assert.ok(readResult(t.s.cfg, a.id).train);
    assert.equal(t.builds(), 3, 'one train build, one baseline, one rerun');
  } finally { t.done(); }
});
