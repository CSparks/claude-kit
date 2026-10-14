// batch.test.mjs — batch trains (KIT-T482 item 1) against real git fixtures: queued disjoint
// patches share ONE build and ONE push, a red member is named and dropped while the rest land,
// a red no member can be blamed for is bisected, and `batch: 1` keeps the one-build-per-job path
// (negative control).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const FILES = ['a.txt', 'b.txt', 'c.txt', 'd.txt'];

// A fixture with four files and a run counter outside the repo: every command run appends one line.
function trainFixture({ batch } = {}) {
  const s = fixture();
  for (const f of FILES) writeFileSync(join(s.root, f), `${f} base\n`);
  g(['add', ...FILES], s.root);
  g(['commit', '-m', 'four files'], s.root);
  g(['push', 'origin', 'main'], s.root);
  g(['--git-dir', s.bare, 'config', 'core.logAllRefUpdates', 'true'], s.root);
  const counterDir = tempDir('train-count-');
  const counter = join(counterDir, 'runs.log').replace(/\\/g, '/');
  const cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], ...(batch ? { batch } : {}) });
  const count = `node -e "require('fs').appendFileSync('${counter}', 'run\\n')"`;
  const builds = () => (existsSync(counter) ? readFileSync(counter, 'utf8').split('\n').filter(Boolean).length : 0);
  const pushes = () => g(['--git-dir', s.bare, 'reflog', 'show', '--format=%H', 'main'], s.root).split('\n').filter(Boolean).length;
  return { ...s, cfg, count, builds, pushes, done: () => { s.done(); cleanup(counterDir); } };
}

// Fails while `file` holds BAD; owned by whichever job lists it.
const noBad = (file) => `node -e "process.exit(require('fs').readFileSync('${file}','utf8').includes('BAD')?1:0)"`;
const anyBad = `node -e "process.exit([${FILES.map((f) => `'${f}'`).join(',')}].some(f=>require('fs').readFileSync(f,'utf8').includes('BAD'))?1:0)"`;
const edit = (file, text) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${text}\n>>>>>>> REPLACE\n`;

function queue(s, file, text, commands, land = true) {
  const { job, result, error } = buildPatchJob(s.cfg, { ticket: `T-${file[0]}`, title: `edit ${file}`, land }, edit(file, text));
  assert.ok(job, JSON.stringify(result || error));
  writeJob(s.cfg, { ...job, commands });
  return job;
}

const subjects = (root, n) => g(['log', `-${n}`, '--reverse', '--pretty=%s'], root).split('\n');
const namesOf = (root, sha) => g(['show', '--name-only', '--pretty=format:', sha], root).split('\n').map((l) => l.trim()).filter(Boolean);

test('four queued disjoint landings: one build, one push, four commits in submit order', () => {
  const s = trainFixture();
  try {
    const jobs = FILES.map((f) => queue(s, f, `${f} new`, [s.count]));
    const pushesBefore = s.pushes();
    processOnce(s.cfg);
    assert.equal(s.builds(), 1, 'the shared command ran once for all four patches');
    assert.equal(s.pushes() - pushesBefore, 1, 'one push carried the train');
    const results = jobs.map((j) => readResult(s.cfg, j.id));
    assert.deepEqual(results.map((r) => r.status), ['landed', 'landed', 'landed', 'landed']);
    assert.ok(results.every((r) => r.train && r.train.id === results[0].train.id && r.train.builds === 1));
    assert.deepEqual(subjects(s.root, 4), FILES.map((f) => `edit ${f} (implements T-${f[0]})`));
    results.forEach((r, i) => assert.deepEqual(namesOf(s.root, r.landed.sha), [FILES[i]], 'each commit holds only its own patch'));
    assert.equal(originSha(s.bare, s.root), g(['rev-parse', 'HEAD'], s.root));
    assert.match(g(['log', '-1', '--pretty=%b'], s.root), /one build with 3 other patch\(es\) in train-/);
    assert.equal(listQueue(s.cfg).length, 0);
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/');
  } finally { s.done(); }
});

test('a red member is named by its own command and dropped; the other three land on the second build', () => {
  const s = trainFixture();
  try {
    const jobs = FILES.map((f) => queue(s, f, f === 'c.txt' ? 'BAD' : `${f} new`, [s.count, noBad(f)]));
    processOnce(s.cfg);
    const results = jobs.map((j) => readResult(s.cfg, j.id));
    assert.deepEqual(results.map((r) => r.status), ['landed', 'landed', 'failed', 'landed']);
    assert.equal(s.builds(), 2, 'one red build, one green rebuild without the culprit');
    assert.match(results[2].message, /^red in train-\S+ \(4 of 4 patches, build 1\): .*c\.txt.* exited 1$/);
    assert.deepEqual(results[2].blame, [`\`${noBad('c.txt')}\` exited 1`]);
    assert.equal(readFileSync(join(s.root, 'c.txt'), 'utf8'), 'c.txt base\n', 'the red patch is restored');
    assert.deepEqual(subjects(s.root, 3), ['edit a.txt (implements T-a)', 'edit b.txt (implements T-b)', 'edit d.txt (implements T-d)']);
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/');
  } finally { s.done(); }
});

test('a compile error from a shared command is pinned on the member whose file it points at', () => {
  const s = trainFixture();
  try {
    const rustc = `node -e "for(const f of [${FILES.map((f) => `'${f}'`).join(',')}])if(require('fs').readFileSync(f,'utf8').includes('BAD')){console.log('error[E0308]: mismatched types\\n --> '+f+':1:1\\n');process.exitCode=101}"`;
    const jobs = FILES.map((f) => queue(s, f, f === 'd.txt' ? 'BAD' : `${f} new`, [s.count, rustc]));
    processOnce(s.cfg);
    const results = jobs.map((j) => readResult(s.cfg, j.id));
    assert.deepEqual(results.map((r) => r.status), ['landed', 'landed', 'landed', 'failed']);
    assert.deepEqual(results[3].blame, ['compile error in d.txt']);
    assert.equal(s.builds(), 2);
  } finally { s.done(); }
});

test('a red no member can be blamed for is bisected: the culprit fails alone, the rest land', () => {
  const s = trainFixture();
  try {
    const jobs = FILES.map((f) => queue(s, f, f === 'b.txt' ? 'BAD' : `${f} new`, [s.count, anyBad]));
    processOnce(s.cfg);
    const results = jobs.map((j) => readResult(s.cfg, j.id));
    assert.deepEqual(results.map((r) => r.status), ['landed', 'failed', 'landed', 'landed']);
    assert.equal(s.builds(), 5, 'abcd red → ab red → a green, b red alone, cd green');
    assert.match(results[1].message, /red in train-.* \(1 of 4 patches/);
    assert.equal(readFileSync(join(s.root, 'b.txt'), 'utf8'), 'b.txt base\n');
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/');
  } finally { s.done(); }
});

test('check-only members pass without riding the landing commit', () => {
  const s = trainFixture();
  try {
    const check = queue(s, 'a.txt', 'a checked', [s.count], false);
    const land = queue(s, 'b.txt', 'b landed', [s.count]);
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, check.id).status, 'passed');
    const r = readResult(s.cfg, land.id);
    assert.equal(r.status, 'landed');
    assert.deepEqual(namesOf(s.root, r.landed.sha), ['b.txt']);
    assert.equal(readFileSync(join(s.root, 'a.txt'), 'utf8'), 'a.txt base\n', 'the check-only patch is restored');
    assert.equal(s.builds(), 1);
  } finally { s.done(); }
});

test('jobs over the same file keep their order: the later one waits for the next build', () => {
  const s = trainFixture();
  try {
    const first = queue(s, 'a.txt', 'a one', [s.count]);
    const clash = { ...queue(s, 'b.txt', 'b two', [s.count]) };
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-x', title: 'touch a again', land: true }, `*** edit a.txt\n<<<<<<< SEARCH\na.txt base\n=======\na other\n>>>>>>> REPLACE\n`);
    writeJob(s.cfg, { ...job, commands: [s.count] });
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, first.id).status, 'landed');
    assert.equal(readResult(s.cfg, clash.id).train.size, 2, 'the disjoint job joined the head');
    assert.equal(readResult(s.cfg, job.id).status, 'stale', 'the overlapping job ran after, on the new HEAD');
  } finally { s.done(); }
});

test('negative control: batch 1 builds once per job', () => {
  const s = trainFixture({ batch: 1 });
  try {
    const jobs = FILES.map((f) => queue(s, f, `${f} new`, [s.count]));
    processOnce(s.cfg);
    assert.equal(s.builds(), 4);
    assert.ok(jobs.every((j) => readResult(s.cfg, j.id).status === 'landed' && !readResult(s.cfg, j.id).train));
  } finally { s.done(); }
});
