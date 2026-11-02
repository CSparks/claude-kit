// runner.test.mjs — the test runner (KIT-T570): every tracked test file is in the manifest, times are
// recorded and ordered longest first, and a failing file fails the run by name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTests } from './discover.mjs';
import { DEFAULT_STATE_TESTS } from './default-state.mjs';
import { isolatedEnv } from './isolate.mjs';
import { runPool } from './pool.mjs';
import { runFile } from './run-file.mjs';
import { planRun } from './select.mjs';
import { longestFirst, readTimes, slowest, writeTimes } from './times.mjs';

const KIT = join(import.meta.dirname, '..', '..');
const RUNNER = join(KIT, 'scripts', 'run-tests.mjs');

function fixtureRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'runner-fx-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

const runner = (root, args = [], env = {}) => spawnSync(process.execPath, [RUNNER, '--root', root, ...args], {
  encoding: 'utf8', env: { ...process.env, KIT_TEST_TIMES: join(root, 'times.json'), KIT_TEST_REQUIRE_REACHED: '', KIT_TEST_BUDGET_S: '', ...env },
});

test('every git-tracked *.test.mjs is in the manifest, including files the old chain never ran', () => {
  const tracked = execFileSync('git', ['ls-files', '*.test.mjs'], { cwd: KIT, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  const manifest = discoverTests(KIT);
  assert.deepEqual(tracked.filter((f) => !manifest.includes(f)), []);
  for (const orphan of ['hooks/agent-reconcile.test.mjs', 'hooks/lib/frameworks.test.mjs', 'hooks/license-guard.test.mjs', 'scripts/capability-research.test.mjs', 'scripts/t-refresh.test.mjs']) {
    assert.ok(manifest.includes(orphan), `${orphan} is run`);
  }
  assert.equal(new Set(manifest).size, manifest.length, 'no file twice');
});

test('an exported tree (no .git) is walked: tests found, node_modules and frameworks skipped', () => {
  const root = fixtureRoot({ 'a/one.test.mjs': '', 'b.test.mjs': '', 'node_modules/x/dep.test.mjs': '', 'frameworks/f/other.test.mjs': '', 'notes.md': '' });
  assert.deepEqual(discoverTests(root), ['a/one.test.mjs', 'b.test.mjs']);
});

test('times merge over the stored file, slowest sorts, and unknown files lead the longest-first order', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'times-')), 'sub', 'times.json');
  writeTimes(file, [{ file: 'a', ms: 10.4 }, { file: 'b', ms: 900 }]);
  writeTimes(file, [{ file: 'c', ms: 50 }]);
  assert.deepEqual(readTimes(file), { a: 10, b: 900, c: 50 });
  assert.deepEqual(slowest([{ file: 'a', ms: 1 }, { file: 'b', ms: 5 }, { file: 'c', ms: 3 }], 2).map((r) => r.file), ['b', 'c']);
  assert.deepEqual(longestFirst(['a', 'b', 'c', 'new'], readTimes(file)), ['new', 'b', 'c', 'a']);
  assert.deepEqual(readTimes(join(tmpdir(), 'no-such-times.json')), {});
});

test('a failing file fails the run and is named; only the passing file is timed and the slowest are printed', () => {
  const root = fixtureRoot({ 'pass.test.mjs': 'process.exit(0);', 'sub/bad.test.mjs': 'console.log("boom-marker"); process.exit(3);' });
  const r = runner(root);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL .*sub\/bad\.test\.mjs/);
  assert.match(r.stdout, /boom-marker/);
  assert.match(r.stdout, /1 FAILED: sub\/bad\.test\.mjs/);
  assert.match(r.stdout, /slowest 10 \(of 2 files/);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(root, 'times.json'), 'utf8')).files).sort(), ['pass.test.mjs']);
});

test('control: all files passing exits 0', () => {
  const root = fixtureRoot({ 'a.test.mjs': '', 'b.test.mjs': '' });
  assert.equal(runner(root).status, 0);
});

const ISOLATED = ['CLAUDE_KIT_DB', 'CLAUDE_KIT_CODE_INDEX_DIR', 'CLAUDE_KIT_REGISTRY', 'CLAUDE_KIT_CACHE_DIR', 'CLAUDE_KIT_TURN_STATE', 'CLAUDE_KIT_SEARCH_LOG_DIR', 'TMP', 'TEMP', 'TMPDIR'];

test('two files get distinct DB, code-index, registry, turn-state and temp dirs (unit)', () => {
  const a = isolatedEnv(process.env, tmpdir(), 'scripts/a.test.mjs');
  const b = isolatedEnv(process.env, tmpdir(), 'scripts/b.test.mjs');
  for (const key of ISOLATED) assert.notEqual(a[key], b[key], `${key} is private to a file`);
  assert.notEqual(isolatedEnv(process.env, tmpdir(), 'scripts/a.test.mjs', 2).CLAUDE_KIT_DB, a.CLAUDE_KIT_DB, 'a rerun starts from fresh state');
});

test('files run by the pool see distinct state and none of the caller\'s own (end to end)', () => {
  const out = mkdtempSync(join(tmpdir(), 'runner-out-'));
  const dump = (name) => `process.getBuiltinModule('fs').writeFileSync(process.env.OUT + '/${name}.json', JSON.stringify(process.env));`;
  const root = fixtureRoot({ 'a.test.mjs': dump('a'), 'b.test.mjs': dump('b') });
  const r = runner(root, [], { OUT: out, CLAUDE_KIT_DB: 'shared-db', TMP: join(out, 'shared-tmp'), KIT_TEST_WORKERS: '2' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const [a, b] = ['a', 'b'].map((n) => JSON.parse(readFileSync(join(out, `${n}.json`), 'utf8')));
  for (const key of ISOLATED) assert.notEqual(a[key], b[key], key);
  assert.notEqual(a.CLAUDE_KIT_DB, 'shared-db');
  assert.equal(a.BROKER_NO_AUTOSTART, '1');
});

test('the pool never runs more than `workers` at once and starts items in the given order', async () => {
  let live = 0;
  let peak = 0;
  const started = [];
  await runPool([1, 2, 3, 4, 5], 2, async (n) => {
    started.push(n);
    peak = Math.max(peak, ++live);
    await new Promise((r) => setTimeout(r, 10));
    live--;
  });
  assert.equal(peak, 2);
  assert.deepEqual(started, [1, 2, 3, 4, 5]);
});

const LINGER_MS = 8000;
const LINGER_LIMIT_MS = 4000;

test('a file is done when its process exits: a daemon it leaves holding stdout neither delays it nor inflates its time (KIT-T824)', async () => {
  const root = fixtureRoot({
    'daemon.test.mjs': `process.getBuiltinModule('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, ${LINGER_MS})'], { stdio: ['ignore', 'inherit', 'inherit'], detached: true }).unref(); console.log('finished-clean');`,
    'bad.test.mjs': 'console.log("failing-output"); process.exit(1);',
  });
  const clean = await runFile(root, 'daemon.test.mjs', process.env);
  assert.equal(clean.ok, true);
  assert.match(clean.output, /finished-clean/);
  assert.ok(clean.ms < LINGER_LIMIT_MS, `took ${clean.ms} ms`);
  const bad = await runFile(root, 'bad.test.mjs', process.env);
  assert.equal(bad.ok, false);
  assert.match(bad.output, /failing-output/, 'negative control: a failing file still returns its output');
});

test('planning budgets a recorded time at no more than the cap, so a poisoned time cannot defer reached files', () => {
  const tests = ['a.test.mjs', 'b.test.mjs'];
  const reached = new Map([['a.test.mjs', 1], ['b.test.mjs', 1]]);
  const poisoned = planRun({ tests, reached, times: { 'a.test.mjs': 4_000_000, 'b.test.mjs': 4_000_000 }, budgetMs: 300_000, workers: 2 });
  assert.deepEqual(poisoned.deferred, []);
  assert.ok(poisoned.estimateMs <= 120_000);
  const honest = planRun({ tests, reached, times: { 'a.test.mjs': 100_000, 'b.test.mjs': 100_000 }, budgetMs: 1_000, workers: 1 });
  assert.equal(honest.deferred.length, 1, 'negative control: real long files still defer under a small budget');
});

const SLOW_FILE_MS = 100000;

function reachedFixture() {
  const root = fixtureRoot({
    'lib.mjs': 'export const v = 1;',
    'a.test.mjs': "import './lib.mjs';",
    'b.test.mjs': "import './lib.mjs';",
  });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  writeFileSync(join(root, 'times.json'), JSON.stringify({ files: { 'a.test.mjs': SLOW_FILE_MS, 'b.test.mjs': SLOW_FILE_MS } }));
  return root;
}

test('--require-reached refuses a run that would defer a file the change reaches, and names it (KIT-T825)', () => {
  const root = reachedFixture();
  const env = { KIT_TEST_WORKERS: '1', KIT_TEST_CHANGED: 'lib.mjs', KIT_TEST_BUDGET_S: '1' };
  const refused = runner(root, ['--require-reached'], env);
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stdout, /REFUSED: 1 of the 2 files this change reaches do not fit the 1s budget/);
  assert.match(refused.stdout, /\.test\.mjs/);
  assert.doesNotMatch(refused.stdout, /^ok /m, 'nothing ran');
});

test('negative control: without the flag the same run defers the file and passes; with a budget that fits, the flag passes', () => {
  const root = reachedFixture();
  const env = { KIT_TEST_WORKERS: '1', KIT_TEST_CHANGED: 'lib.mjs', KIT_TEST_BUDGET_S: '1' };
  assert.equal(runner(root, [], env).status, 0);
  const fits = runner(root, ['--require-reached'], { ...env, KIT_TEST_BUDGET_S: '300' });
  assert.equal(fits.status, 0, fits.stdout);
  assert.match(fits.stdout, /0 of them reached by the change/);
});

test('a file that fails once and passes alone is reported as FLAKE and does not fail the run', () => {
  const marker = join(mkdtempSync(join(tmpdir(), 'runner-flake-')), 'seen');
  const root = fixtureRoot({ 'flaky.test.mjs': `const fs = process.getBuiltinModule('fs'); const m = ${JSON.stringify(marker)}; if (!fs.existsSync(m)) { fs.writeFileSync(m, ''); process.exit(1); }` });
  const r = runner(root);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /FLAKE .*flaky\.test\.mjs/);
  assert.match(r.stdout, /1 FLAKE \(failed, then passed alone\): flaky\.test\.mjs/);
});

test('a file that fails twice fails the run, named once with its output', () => {
  const root = fixtureRoot({ 'bad.test.mjs': 'console.log("still-broken"); process.exit(1);' });
  const r = runner(root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /1 FAILED: bad\.test\.mjs/);
  assert.match(r.stdout, /still-broken/);
});

test('a file over the wall limit fails the run as SLOW; with the limit off it passes', () => {
  const root = fixtureRoot({ 'slow.test.mjs': 'setTimeout(() => {}, 700);' });
  const slow = runner(root, [], { KIT_TEST_MAX_FILE_S: '0.3' });
  assert.equal(slow.status, 1, slow.stdout);
  assert.match(slow.stdout, /1 SLOW \(over 0\.3s\): slow\.test\.mjs/);
  assert.equal(runner(root, [], { KIT_TEST_MAX_FILE_S: '0' }).status, 0);
});

test('the default-state files exist and keep the install-default DB, code-index and cache unset while their other state stays private', () => {
  const manifest = discoverTests(KIT);
  for (const f of DEFAULT_STATE_TESTS) assert.ok(manifest.includes(f), f);
  const env = isolatedEnv({ CLAUDE_KIT_DB: 'x' }, tmpdir(), DEFAULT_STATE_TESTS[0], 1, { keepDefaults: true });
  assert.equal(env.CLAUDE_KIT_DB, 'x', 'a keepDefaults file inherits instead of getting a private DB');
  assert.ok(env.CLAUDE_KIT_REGISTRY && env.TMP && env.CLAUDE_KIT_TURN_STATE, 'registry, temp and turn state stay private');
});
