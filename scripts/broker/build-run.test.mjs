// build-run.test.mjs — the build runner end to end with a fake cargo (KIT-D135): a compiling command is cut to
// the cores it holds, anything else passes untouched, and a project's `-j 24` never reaches cargo above the budget.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './build-classify.mjs';
import { HELD_ENV } from './build-env.mjs';
import { LONG_HOLD_MS, MIN_ELASTIC_GRANT } from './build-grant.mjs';
import { SLOT_PREFIX } from './build-slot-store.mjs';
import { findReal } from './build-run.mjs';
import { clampJobs, requestedJobs } from './jobs-flags.mjs';

const RUNNER = fileURLToPath(new URL('./build-run.mjs', import.meta.url));
const PHYSICAL = 16;
const BUDGET = 14;
const GAME_BUDGET = 8;
const PLENTY_OF_MEMORY = 2 ** 40;

function fakeCargo(dir) {
  const probe = join(dir, 'probe.mjs');
  writeFileSync(probe, 'const e = process.env; console.log(JSON.stringify({ args: process.argv.slice(2), jobs: e.CARGO_BUILD_JOBS, test: e.RUST_TEST_THREADS, nextest: e.NEXTEST_TEST_THREADS, held: e.CLAUDE_KIT_BUILD_HELD }));');
  const win = process.platform === 'win32';
  const file = join(dir, win ? 'cargo.cmd' : 'cargo');
  writeFileSync(file, win ? `@"${process.execPath}" "${probe}" %*\r\n` : `#!/bin/sh\nexec "${process.execPath}" "${probe}" "$@"\n`);
  if (!win) chmodSync(file, 0o755);
}

function holdCores(dir, jobs, ageMs) {
  const slots = join(dir, 'slots');
  mkdirSync(slots, { recursive: true });
  const rec = { pid: process.pid, host: hostname(), jobs, label: 'other build', cwd: dir, ts: new Date(Date.now() - ageMs).toISOString() };
  writeFileSync(join(slots, `${SLOT_PREFIX}other`), JSON.stringify(rec));
}

function run(args, extraEnv = {}, { held = 0, heldForMs = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'build-run-'));
  fakeCargo(dir);
  if (held) holdCores(dir, held, heldForMs);
  const env = {
    ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, CLAUDE_KIT_BUG_STORE: join(dir, 'no-kit-store'),
    CLAUDE_KIT_BUILD_SLOT_DIR: join(dir, 'slots'), CLAUDE_KIT_BUILD_BUDGET_FILE: join(dir, 'budget.json'),
    CLAUDE_KIT_PHYSICAL_CORES: String(PHYSICAL), CLAUDE_KIT_GAME_RUNNING: '0', CLAUDE_KIT_BUILD_MAX_WAIT_S: '5', CLAUDE_KIT_COMMIT_FREE_BYTES: String(PLENTY_OF_MEMORY), ...extraEnv,
  };
  if (!(HELD_ENV in extraEnv)) delete env[HELD_ENV];
  try {
    const r = spawnSync(process.execPath, [RUNNER, 'cargo', ...args], { env, cwd: dir, encoding: 'utf8' });
    return { ...r, seen: r.stdout.trim().startsWith('{') ? JSON.parse(r.stdout.trim()) : null, slotsMade: existsSync(join(dir, 'slots')) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('jobs flags: the largest request is read and every value above the cores is cut', () => {
  assert.equal(requestedJobs(['test', '-j', '15', '--', '--test-threads=32']), 32);
  assert.equal(requestedJobs(['build']), null);
  assert.deepEqual(clampJobs(['test', '-j', '24', '--jobs=30', '-j3', '-p', 'x'], 14), ['test', '-j', '14', '--jobs=14', '-j3', '-p', 'x']);
});

test('classify: builds are gated, a run keeps its program out of the hold, info and fmt pass', () => {
  assert.deepEqual(classify('cargo', ['test', '-p', 'x'], tmpdir()), { gated: true, runs: false, sub: 'test' });
  assert.equal(classify('cargo', ['r'], tmpdir()).runs, true);
  assert.equal(classify('cargo', ['+nightly', 'check'], tmpdir()).gated, true);
  assert.equal(classify('cargo', ['fmt'], tmpdir()).gated, false);
  assert.equal(classify('cargo', ['--version'], tmpdir()).gated, false);
  assert.equal(classify('cargo-ndk', ['-t', 'arm64-v8a', 'build'], tmpdir()).gated, true);
});

test('findReal skips the shim directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-find-'));
  fakeCargo(dir);
  try {
    assert.equal(findReal('cargo', { PATH: dir }, dir), null);
    assert.ok(findReal('cargo', { PATH: dir }, join(dir, 'elsewhere')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a project -j 24 reaches cargo as the budget, with every thread setting cut to it', () => {
  const r = run(['test', '-j', '24']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.seen.args, ['test', '-j', String(BUDGET)]);
  assert.deepEqual([r.seen.jobs, r.seen.test, r.seen.nextest], [String(BUDGET), String(BUDGET), String(BUDGET)]);
  assert.ok(r.seen.held, 'the child is marked as holding cores, so nested tools pass through');
});

test('a running game cuts the budget the build gets', () => {
  const r = run(['build'], { CLAUDE_KIT_GAME_RUNNING: '1' });
  assert.equal(r.seen.jobs, String(GAME_BUDGET));
});

test('a build with no -j runs on the whole budget, never the machine\'s logical cores', () => {
  assert.equal(run(['check']).seen.jobs, String(BUDGET));
});

const OTHER_HOLDS_ROOM_FOR_SIX = 8;
const QUEUE_WAIT_S = '2';

test('KIT-T1017: a plain build that finds fewer cores free than it wants runs capped to them and says so', () => {
  const r = run(['test', '-p', 'x'], {}, { held: OTHER_HOLDS_ROOM_FOR_SIX });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.seen.jobs, String(BUDGET - OTHER_HOLDS_ROOM_FOR_SIX));
  assert.match(r.stderr, /asked for \d+ cores, running on 6/);
});

test('KIT-T1017: a build that never gets cores does not run and exits non-zero naming why', () => {
  const r = run(['test', '-p', 'x'], { CLAUDE_KIT_BUILD_MAX_WAIT_S: QUEUE_WAIT_S }, { held: BUDGET });
  assert.notEqual(r.status, 0, 'a build that did not run must not read as a pass');
  assert.equal(r.seen, null, 'cargo was not started');
  assert.match(r.stderr, /not started/);
  assert.match(r.stderr, new RegExp(`queued for ${BUDGET} cores \\(budget ${BUDGET}\\)`), 'the queue message names the cores the build can get, never more than the budget');
});

test('KIT-T1031: the exit-75 message names who holds the cores, the root and for how long', () => {
  const r = run(['test', '-p', 'x'], { CLAUDE_KIT_BUILD_MAX_WAIT_S: QUEUE_WAIT_S }, { held: BUDGET, heldForMs: 90000 });
  assert.equal(r.status, 75);
  assert.match(r.stderr, new RegExp(`held by pid ${process.pid} on ${BUDGET} cores for (9\\d)s, root \\S+.*, job other build`));
});

test('KIT-T1031: a build starts on a small slice beside a hold past the 5-minute ceiling', () => {
  const r = run(['test', '-p', 'x'], {}, { held: BUDGET, heldForMs: LONG_HOLD_MS + 1000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.seen.jobs, String(MIN_ELASTIC_GRANT));
});

test('KIT-T1031: a hold under the ceiling gives the build no slice', () => {
  const r = run(['test', '-p', 'x'], { CLAUDE_KIT_BUILD_MAX_WAIT_S: QUEUE_WAIT_S }, { held: BUDGET, heldForMs: LONG_HOLD_MS - 60000 });
  assert.equal(r.status, 75);
  assert.equal(r.seen, null);
});

test('a build that does not compile, and a tool a build started, pass untouched without taking cores', () => {
  const fmt = run(['fmt', '-j', '24']);
  assert.deepEqual(fmt.seen.args, ['fmt', '-j', '24']);
  assert.equal(fmt.slotsMade, false);
  const nested = run(['test', '-j', '24'], { [HELD_ENV]: '1' });
  assert.deepEqual(nested.seen.args, ['test', '-j', '24']);
});
