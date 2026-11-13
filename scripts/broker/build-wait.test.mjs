// build-wait.mjs — `builds --wait <file>` waits, once and in the foreground, until no build compiles that file (KIT-T1142).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capSeconds } from './build-wait.mjs';
import { DEFAULT_TOOL_TIMEOUT_S, HARNESS_FOREGROUND_S, MAX_FOREGROUND_WAIT_S, TOOL_MARGIN_S } from './wait-limits.mjs';

const STATUS = fileURLToPath(new URL('./build-status.mjs', import.meta.url));
const slots = mkdtempSync(join(tmpdir(), 'bwait-slots-'));
const crate = join(mkdtempSync(join(tmpdir(), 'bwait-tree-')), 'crates', 'a');
mkdirSync(join(crate, 'src'), { recursive: true });
const file = join(crate, 'src', 'lib.rs').replace(/\\/g, '/');
writeFileSync(file, 'pub fn a() {}\n');
const SLOW_POLL_MS = 100;

const hold = (pid, extra = {}) => writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid, host: hostname(), label: `${crate}: cargo test -p a`, cwd: crate, jobs: 4, ts: new Date().toISOString(), scope: [crate], writer: 'S1|builder', phase: 'compiling', ...extra }));
const wait = (...args) => spawnSync(process.execPath, [STATUS, '--wait', file, '--poll', String(SLOW_POLL_MS), ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_BUILD_SLOT_DIR: slots } });
const clear = () => rmSync(join(slots, 'slot-1'), { force: true });

test('no live hold: returns at once, exit 0', () => {
  clear();
  const started = Date.now();
  const r = wait('--timeout', '30');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no build is compiling/);
  assert.ok(Date.now() - started < 10000, 'did not sit out the cap');
});

test('a hold of a dead process counts as no hold', () => {
  hold(2 ** 22 + 4321);
  assert.equal(wait('--timeout', '30').status, 0);
});

test('a build in its test phase no longer compiles the file: exit 0 at once', () => {
  hold(process.pid, { phase: 'running' });
  assert.equal(wait('--timeout', '30').status, 0);
});

test('a hold whose scope misses the file is not waited on', () => {
  hold(process.pid, { scope: [join(crate, '..', 'b')] });
  assert.equal(wait('--timeout', '30').status, 0);
});

test('past the cap: exit 2 naming the holder, its starter and how long it has held', () => {
  hold(process.pid);
  const started = Date.now();
  const r = wait('--timeout', '1');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`pid ${process.pid}`));
  assert.match(r.stdout, /S1\|builder/);
  assert.match(r.stdout, /cargo test -p a/);
  assert.match(r.stdout, /still compiling after \d+s/);
  assert.ok(Date.now() - started < 10000);
});

test('returns 0 naming who held and for how long once the holding build ends', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1500)'], { stdio: 'ignore' });
  hold(child.pid);
  const result = await new Promise((resolve) => {
    const proc = spawn(process.execPath, [STATUS, '--wait', file, '--poll', String(SLOW_POLL_MS), '--timeout', '30'], { env: { ...process.env, CLAUDE_KIT_BUILD_SLOT_DIR: slots } });
    let out = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.on('close', (code) => resolve({ code, out }));
  });
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, new RegExp(`pid ${child.pid}`));
  assert.match(result.out, /S1\|builder/);
  assert.match(result.out, /stopped compiling after \d+s/);
});

test('the cap never exceeds the harness window, and defaults to fit the default Bash call', () => {
  assert.equal(capSeconds({ timeout: '900', 'tool-timeout': '900' }), MAX_FOREGROUND_WAIT_S);
  assert.equal(capSeconds({ timeout: String(MAX_FOREGROUND_WAIT_S), 'tool-timeout': String(HARNESS_FOREGROUND_S) }), MAX_FOREGROUND_WAIT_S);
  assert.ok(capSeconds({}) <= DEFAULT_TOOL_TIMEOUT_S - TOOL_MARGIN_S);
});

test.after(() => {
  rmSync(slots, { recursive: true, force: true });
});
