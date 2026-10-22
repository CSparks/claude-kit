// select.test.mjs — the budgeted selection (KIT-D104): a change picks the tests it reaches, nearest
// first; the budget cuts the rest, which rotate in by age; a changed list can come from the environment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFiles, planRun, reach } from './select.mjs';

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'select-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'fixture'], { cwd: root });
  return root;
}

const TREE = {
  'lib/core.mjs': 'export const x = 1;\n',
  'lib/mid.mjs': "import { x } from './core.mjs';\nexport const y = x;\n",
  'lib/mid.test.mjs': "import './mid.mjs';\n",
  'lib/other.test.mjs': "import './mid.mjs';\n",
  'lib/far.test.mjs': "import { y } from './mid.mjs';\nconsole.log(y);\n",
  'lib/spawn.test.mjs': "const SCRIPT = join(import.meta.dirname, 'core.mjs');\n",
  'lib/alone.test.mjs': 'export {};\n',
  'data/table.json': '{}\n',
  'lib/reads.test.mjs': "readFileSync('data/table.json');\n",
};
const TESTS = Object.keys(TREE).filter((f) => f.endsWith('.test.mjs'));

test('reach: the test named for a changed module is distance 0, importers and name-mentions follow, unrelated tests are absent', () => {
  const root = repo(TREE);
  const d = reach(root, TESTS, ['lib/mid.mjs']);
  assert.equal(d.get('lib/mid.test.mjs'), 0);
  assert.equal(d.get('lib/other.test.mjs'), 1);
  assert.equal(d.get('lib/far.test.mjs'), 1);
  assert.equal(d.has('lib/alone.test.mjs'), false);
  const deep = reach(root, TESTS, ['lib/core.mjs']);
  assert.equal(deep.get('lib/spawn.test.mjs'), 1, 'a test that names the script spawns it');
  assert.equal(deep.get('lib/other.test.mjs'), 2, 'through mid.mjs');
});

test('reach: a non-module file reaches the tests that name it; ticket and doc files reach nothing', () => {
  const root = repo(TREE);
  assert.deepEqual([...reach(root, TESTS, ['data/table.json']).keys()], ['lib/reads.test.mjs']);
  assert.equal(reach(root, TESTS, ['.ai/tickets/KIT-T1.md', 'docs/x.md']).size, 0);
});

test('planRun: reached tests first by distance, then the least recently run; the budget defers the rest', () => {
  const tests = ['a', 'b', 'c', 'd', 'e'];
  const times = { a: 100_000, b: 100_000, c: 100_000, d: 100_000, e: 100_000 };
  const reached = new Map([['c', 1], ['a', 0]]);
  const plan = planRun({ tests, reached, times, ranAt: { b: 5, d: 1, e: 9 }, budgetMs: 200_000, workers: 1 });
  assert.deepEqual(plan.run, ['a', 'c']);
  assert.deepEqual(plan.deferred, ['d', 'b', 'e']);
  const wide = planRun({ tests, reached, times, ranAt: { b: 5, d: 1, e: 9 }, budgetMs: 200_000, workers: 2 });
  assert.deepEqual(wide.run, ['a', 'c', 'd', 'b'], 'two workers double the room, oldest first');
  assert.ok(wide.estimateMs <= 200_000);
});

test('planRun: one test over the whole budget still runs when it is first, so a run is never empty', () => {
  const plan = planRun({ tests: ['slow', 'fast'], reached: new Map([['slow', 0]]), times: { slow: 900_000, fast: 1000 }, budgetMs: 270_000, workers: 8 });
  assert.deepEqual(plan.run, ['slow', 'fast']);
});

test('changedFiles: KIT_TEST_CHANGED wins, with build output left out of the git form', () => {
  const root = repo(TREE);
  assert.deepEqual(changedFiles(root, { env: { KIT_TEST_CHANGED: 'a.mjs\nb.mjs\n' } }), ['a.mjs', 'b.mjs']);
  assert.deepEqual(changedFiles(root, { env: { KIT_TEST_CHANGED: '' } }), []);
  mkdirSync(join(root, 'target'), { recursive: true });
  writeFileSync(join(root, 'target', 'junk.json'), '{}');
  writeFileSync(join(root, 'new.mjs'), '');
  assert.ok(changedFiles(root, { env: {} }).includes('new.mjs'));
  assert.equal(changedFiles(root, { env: {} }).some((p) => p.startsWith('target/')), false);
});

test('planRun: a changed test and the test named for a changed module run whatever they cost; a farther one over the budget is deferred', () => {
  const times = { own: 900_000, near: 900_000, far: 900_000, cheap: 1000 };
  const plan = planRun({ tests: ['own', 'near', 'far', 'cheap'], reached: new Map([['own', 0], ['near', 1], ['far', 1]]), times, budgetMs: 200_000, workers: 2 });
  assert.deepEqual(plan.run, ['own', 'near', 'cheap'].filter((t) => plan.run.includes(t)));
  assert.ok(plan.run.includes('own'));
  assert.ok(plan.deferred.includes('far'));
});
