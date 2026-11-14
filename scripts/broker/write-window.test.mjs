// write-window.mjs — a writer whose edit was refused, or whose `builds --wait` returned free, lands that edit before the next
// build of another writer takes its hold (KIT-T1175). Two fake builds race one writer's edit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBuildSlot } from './build-slot.mjs';
import { FREE_WINDOW_S, KIND, REFUSED_WINDOW_S, START_WAIT_S, blockingWindows, closeWindow, openWindow, waitOutWindows, windowFor } from './write-window.mjs';

const STATUS = fileURLToPath(new URL('./build-status.mjs', import.meta.url));
const slots = mkdtempSync(join(tmpdir(), 'wwin-slots-'));
process.env.CLAUDE_KIT_BUILD_SLOT_DIR = slots;
const crate = join(mkdtempSync(join(tmpdir(), 'wwin-tree-')), 'crates', 'a');
mkdirSync(join(crate, 'src'), { recursive: true });
const file = join(crate, 'src', 'lib.rs').replace(/\\/g, '/');
writeFileSync(file, 'pub fn a() {}\n');
const WAITER = 'S2|waiter';
const BUILDER = 'S1|builder';
const SECOND = 1000;
const probes = { physicalCores: () => 8, commitFreeBytes: () => Infinity, gameRunning: () => false };
const clock = (start = Date.now()) => { const t = { at: start }; return { now: () => t.at, sleep: (ms) => { t.at += ms; } }; };
const reset = () => readdirSync(slots).forEach((n) => rmSync(join(slots, n), { recursive: true, force: true }));

test('a window blocks another writer\'s build start on a scope that holds the file, never the writer\'s own or an unrelated scope', () => {
  reset();
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE });
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER }).length, 1);
  assert.equal(blockingWindows({ scope: [crate], writer: WAITER }).length, 0, 'control: the waiter\'s own build is not held');
  assert.equal(blockingWindows({ scope: [join(crate, '..', 'b')], writer: BUILDER }).length, 0, 'control: a build of another crate is not held');
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: Date.now() + (FREE_WINDOW_S + 1) * SECOND }).length, 0, 'control: an expired window holds nothing');
});

test('race: build B starting while the waiter\'s edit is pending waits, and goes ahead the moment the edit lands', () => {
  reset();
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE });
  const t = clock();
  let told = null;
  const sleep = (ms) => { t.sleep(ms); closeWindow({ file, writer: WAITER }); };
  const result = waitOutWindows({ scope: [crate], writer: BUILDER, onWait: (w) => { told = w; }, sleep, now: t.now });
  assert.equal(told.writer, WAITER, 'B named the writer it yielded to');
  assert.ok(result.waitedMs > 0 && result.waitedMs < START_WAIT_S * SECOND, 'B waited, then proceeded when the edit landed');
  assert.equal(windowFor({ file }), null, 'the landed edit closed the window');
});

test('control: an edit that never lands holds the build start for START_WAIT_S only', () => {
  reset();
  openWindow({ file, writer: WAITER, seconds: 10 * START_WAIT_S, kind: KIND.FREE });
  const t = clock();
  const result = waitOutWindows({ scope: [crate], writer: BUILDER, sleep: t.sleep, now: t.now });
  assert.ok(result.waitedMs >= START_WAIT_S * SECOND && result.waitedMs < (START_WAIT_S + 1) * SECOND, `waited ${result.waitedMs} ms`);
});

test('control: with no window the build starts without waiting', () => {
  reset();
  const t = clock();
  assert.equal(waitOutWindows({ scope: [crate], writer: BUILDER, sleep: t.sleep, now: t.now }).waitedMs, 0);
});

test('acquireBuildSlot runs beforeStart after the cores are granted and before the hold exists', () => {
  reset();
  let holdExisted = null;
  const slot = acquireBuildSlot('cargo test', { jobs: 1, force: true, probes, meta: { scope: [crate], writer: BUILDER }, beforeStart: () => { holdExisted = readdirSync(slots).some((n) => n.startsWith('slot-')); } });
  const holds = readdirSync(slots).filter((n) => n.startsWith('slot-')).length;
  slot.release();
  assert.equal(holdExisted, false, 'the window wait precedes the hold');
  assert.equal(holds, 1, 'control: the hold is written after it');
});

test('the wait keeps a pending-edit window open while a build compiles the file, then a free window; build B yields to it, build A does not', async () => {
  reset();
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1500)'], { stdio: 'ignore' });
  writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: child.pid, host: hostname(), label: `${crate}: cargo test -p a`, cwd: crate, jobs: 4, ts: new Date().toISOString(), scope: [crate], writer: BUILDER, phase: 'compiling' }));
  const proc = spawn(process.execPath, [STATUS, '--wait', file, '--writer', WAITER, '--poll', '100', '--timeout', '30'], { env: { ...process.env, CLAUDE_KIT_BUILD_SLOT_DIR: slots } });
  let out = '';
  proc.stdout.on('data', (d) => { out += d; });
  await new Promise((r) => setTimeout(r, 600));
  const during = windowFor({ file });
  assert.equal(during?.kind, KIND.REFUSED, 'while build A compiles, the waiter\'s pending edit holds a window');
  assert.ok(Date.parse(during.ts) <= Date.now() && new Date(during.until) - Date.now() <= REFUSED_WINDOW_S * SECOND);
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER }).length, 1, 'build B (another writer) would yield');
  const code = await new Promise((r) => proc.on('close', r));
  assert.equal(code, 0, out);
  const after = windowFor({ file });
  assert.equal(after?.kind, KIND.FREE, 'a free wait leaves the free window');
  assert.equal(after.writer, WAITER);
  assert.match(out, new RegExp(`within ${FREE_WINDOW_S}s`));
});

test.after(() => {
  rmSync(slots, { recursive: true, force: true });
});
