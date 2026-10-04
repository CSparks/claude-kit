// land-sync.test.mjs — a landing whose remote moved fetches and rebases before it pushes (KIT-T319):
// unrelated movement lands after a rebase (tests re-run), conflicting movement reports `conflict` and
// leaves the tree untouched, an unmoved remote pushes as before, and the submodule pin rebases too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { printResult } from './report.mjs';
import { commitOnMain, envelope, fixture, g, originSha, snapshot } from './patchkit.mjs';
import { addOrigin, cleanup, makeRepo, tempDir } from './testkit.mjs';

// Another checkout of the same origin pushes `file` = `text`.
function pushFromElsewhere(s, file, text) {
  const other = tempDir('other-');
  g(['clone', '-q', s.bare, other], s.root);
  for (const [k, v] of [['user.email', 'o@test'], ['user.name', 'Other'], ['commit.gpgsign', 'false']]) g(['config', k, v], other);
  commitOnMain(other, file, text, `other: ${file}`);
  g(['push', 'origin', 'main'], other);
  cleanup(other);
}

// A command appending one line per run to `path` (a log outside the tree).
const counter = (path) => {
  const script = join(tempDir('append-'), 'append.mjs');
  writeFileSync(script, ["import { appendFileSync } from 'node:fs';", "appendFileSync(process.argv[2], 'x' + String.fromCharCode(10));", ''].join(String.fromCharCode(10)));
  return `node ${script} ${path}`;
};

function land(s, env, command) {
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-9', title: 'change', land: true }, env);
  writeJob(s.cfg, { ...job, commands: [command] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
}

test('origin moved on an unrelated file: the commit is rebased onto it, tests re-run, and it pushes', () => {
  const s = fixture();
  const log = join(tempDir('runs-'), 'runs.log');
  try {
    pushFromElsewhere(s, 'elsewhere.rs', 'moved\n');
    const r = land(s, envelope(['beta', 'BETA']), counter(log));
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(readFileSync(log, 'utf8').split('\n').filter(Boolean).length, 2, 'job run + re-run after the rebase');
    assert.equal(originSha(s.bare, s.root), r.landed.sha);
    assert.equal(g(['rev-parse', 'HEAD'], s.root), r.landed.sha);
    assert.equal(existsSync(join(s.root, 'elsewhere.rs')), true, 'the incoming file is in the tree');
    assert.equal(g(['rev-list', '--count', 'HEAD'], s.root), '4', 'init, add src, other, job: a linear history');
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/');
  } finally { s.done(); }
});

test('a rebase that brings only documentation pushes without re-running the tests', () => {
  const s = fixture();
  const log = join(tempDir('runs-'), 'runs.log');
  try {
    pushFromElsewhere(s, 'NOTES.md', 'docs\n');
    const r = land(s, envelope(['beta', 'BETA']), counter(log));
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(readFileSync(log, 'utf8').split('\n').filter(Boolean).length, 1);
  } finally { s.done(); }
});

test('negative: an origin that did not move pushes as before, with no re-run', () => {
  const s = fixture();
  const log = join(tempDir('runs-'), 'runs.log');
  try {
    const r = land(s, envelope(['beta', 'BETA']), counter(log));
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(readFileSync(log, 'utf8').split('\n').filter(Boolean).length, 1);
    assert.equal(originSha(s.bare, s.root), r.landed.sha);
  } finally { s.done(); }
});

test('origin moved on the same lines: the result is `conflict`, naming the file, and the tree is untouched', () => {
  const s = fixture();
  try {
    pushFromElsewhere(s, 'src.txt', 'alpha\nbravo\ngamma\n');
    const before = { ...snapshot(s.root), head: g(['rev-parse', 'HEAD'], s.root) };
    const r = land(s, envelope(['beta', 'BETA']), 'node -e "process.exit(0)"');
    assert.equal(r.status, 'conflict', JSON.stringify(r));
    assert.deepEqual(r.conflict, ['src.txt']);
    const lines = []; printResult(r, (l) => lines.push(l));
    assert.ok(lines.some((l) => l.includes('conflict: src.txt')));
    assert.deepEqual({ ...snapshot(s.root), head: g(['rev-parse', 'HEAD'], s.root) }, before);
    assert.equal(existsSync(join(s.root, '.git', 'rebase-merge')), false, 'no rebase left in progress');
  } finally { s.done(); }
});

test('origin moved on a file the maintainer has uncommitted edits in: conflict, edits kept', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'mine.txt', 'base\n', 'add mine');
    g(['push', 'origin', 'main'], s.root);
    writeFileSync(join(s.root, 'mine.txt'), 'my edit\n');
    pushFromElsewhere(s, 'mine.txt', 'theirs\n');
    const r = land(s, envelope(['beta', 'BETA']), 'node -e "process.exit(0)"');
    assert.equal(r.status, 'conflict', JSON.stringify(r));
    assert.deepEqual(r.conflict, ['mine.txt']);
    assert.equal(readFileSync(join(s.root, 'mine.txt'), 'utf8'), 'my edit\n');
  } finally { s.done(); }
});

test('the superproject pin commit fetches and rebases before it pushes', () => {
  const subOriginDir = tempDir('sub-bare-');
  const subSrc = makeRepo(tempDir('sub-src-'));
  const subBare = addOrigin(subSrc, join(subOriginDir, 'sub.git')).replace(/\\/g, '/');
  const superRoot = makeRepo(tempDir('super-root-'));
  const superBareDir = tempDir('super-bare-');
  const superBare = addOrigin(superRoot, join(superBareDir, 'super.git'));
  g(['-c', 'protocol.file.allow=always', 'submodule', 'add', subBare, 'rapid-game'], superRoot);
  g(['commit', '-m', 'add submodule'], superRoot);
  g(['push', 'origin', 'main'], superRoot);
  const subPath = join(superRoot, 'rapid-game');
  g(['checkout', 'main'], subPath);
  for (const [k, v] of [['user.email', 'broker@test'], ['user.name', 'Broker Test'], ['commit.gpgsign', 'false']]) g(['config', k, v], subPath);
  const cfg = normalizeBroker(superRoot, {
    repos: [{ name: 'super', path: '.', main: 'main', remote: 'origin' }, { name: 'rapid-game', path: 'rapid-game', main: 'main', remote: 'origin', submodule: true, pin_in: '.' }],
    verify_default: ['node -e "process.exit(0)"'],
  });
  const other = tempDir('super-other-');
  try {
    g(['clone', '-q', superBare, other], superRoot);
    for (const [k, v] of [['user.email', 'o@test'], ['user.name', 'Other'], ['commit.gpgsign', 'false']]) g(['config', k, v], other);
    commitOnMain(other, 'unrelated.txt', 'u\n', 'other super change');
    g(['push', 'origin', 'main'], other);
    const { job } = buildPatchJob(cfg, { repo: 'rapid-game', ticket: 'ST-T1', title: 'sub feat', land: true }, '*** write s.txt\nsub feature\n');
    writeJob(cfg, job);
    processOnce(cfg);
    const r = readResult(cfg, job.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['--git-dir', superBare, 'rev-parse', 'main'], superRoot), g(['rev-parse', 'HEAD'], superRoot), 'super pushed after the rebase');
    assert.equal(existsSync(join(superRoot, 'unrelated.txt')), true);
  } finally { cleanup(superRoot); cleanup(subSrc); cleanup(subOriginDir); cleanup(superBareDir); cleanup(other); }
});
