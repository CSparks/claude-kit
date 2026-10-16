// train-gate.test.mjs — a pre-push gate refusal in a train drops the member it names (or the
// member a bisection pins) and lands the rest (KIT-T535). Controls: a green gate lands the whole
// train in one push; a gate refusal that blames nobody and a lone patch both fail only that patch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const FILES = ['a.txt', 'b.txt', 'c.txt'];
const PASS = 'node -e "0"';
const edit = (file, text) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${text}\n>>>>>>> REPLACE\n`;

// A pre-push hook that refuses while any tracked file holds BAD; `names` makes it print the file.
function gateFixture({ names }) {
  const s = fixture();
  for (const f of FILES) writeFileSync(join(s.root, f), `${f} base\n`);
  g(['add', ...FILES], s.root);
  g(['commit', '-m', 'files'], s.root);
  g(['push', 'origin', 'main'], s.root);
  const dir = tempDir('train-gate-');
  const body = names
    ? 'for f in a.txt b.txt c.txt; do if grep -q BAD "$f"; then echo "gate: $f is wrong" >&2; exit 1; fi; done'
    : 'for f in a.txt b.txt c.txt; do if grep -q BAD "$f"; then echo "gate: refused" >&2; exit 1; fi; done';
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pre-push'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  g(['config', 'core.hooksPath', dir], s.root);
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: true }], verify_default: [PASS] });
  return { ...s, done: () => { s.done(); cleanup(dir); } };
}

function queue(s, file, text) {
  const { job } = buildPatchJob(s.cfg, { ticket: `T-${file[0]}`, title: `edit ${file}`, land: true }, edit(file, text));
  writeJob(s.cfg, { ...job, commands: [PASS] });
  return job;
}
const onRemote = (s, file) => g(['--git-dir', s.bare, 'show', `main:${file}`], s.root);

test('a gate refusal naming one member drops it and lands the other two', () => {
  const s = gateFixture({ names: true });
  try {
    const jobs = [queue(s, 'a.txt', 'a new'), queue(s, 'b.txt', 'b BAD'), queue(s, 'c.txt', 'c new')];
    processOnce(s.cfg);
    const status = jobs.map((j) => readResult(s.cfg, j.id).status);
    assert.deepEqual(status, ['landed', 'failed', 'landed'], JSON.stringify(jobs.map((j) => readResult(s.cfg, j.id).message)));
    assert.match(readResult(s.cfg, jobs[1].id).message, /b\.txt is wrong/);
    assert.match(onRemote(s, 'a.txt'), /a new/);
    assert.match(onRemote(s, 'c.txt'), /c new/);
    assert.match(onRemote(s, 'b.txt'), /b\.txt base/);
    assert.equal(readFileSync(join(s.root, 'b.txt'), 'utf8'), 'b.txt base\n', 'the dropped patch leaves no edit in the tree');
  } finally { s.done(); }
});

test('a refusal that names nobody is bisected: the culprit fails, the others land', () => {
  const s = gateFixture({ names: false });
  try {
    const jobs = [queue(s, 'a.txt', 'a new'), queue(s, 'b.txt', 'b BAD'), queue(s, 'c.txt', 'c new')];
    processOnce(s.cfg);
    assert.deepEqual(jobs.map((j) => readResult(s.cfg, j.id).status), ['landed', 'failed', 'landed']);
    assert.match(onRemote(s, 'c.txt'), /c new/);
  } finally { s.done(); }
});

test('controls: a green gate lands the whole train in one push; a lone refused patch fails alone', () => {
  const s = gateFixture({ names: true });
  try {
    const before = originSha(s.bare, s.root);
    const jobs = [queue(s, 'a.txt', 'a new'), queue(s, 'c.txt', 'c new')];
    processOnce(s.cfg);
    assert.deepEqual(jobs.map((j) => readResult(s.cfg, j.id).status), ['landed', 'landed']);
    assert.notEqual(originSha(s.bare, s.root), before);
    const bad = queue(s, 'b.txt', 'b BAD');
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, bad.id).status, 'failed');
  } finally { s.done(); }
});
