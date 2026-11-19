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
import { LONG_LIMIT_MS } from '../../hooks/lib/hook-limits.mjs';
import { BATCH_CEILING_S, BATCH_IDLE_S, EDIT_GAP_S, FREE_WINDOW_S, IN_FLIGHT_S, KIND, REFUSED_WINDOW_S, START_WAIT_S, blockingWindows, closeWindow, holdWindowsInFlight, openWindow, settleWindows, waitOutWindows, windowFor } from './write-window.mjs';

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

test('race: build B starting while the waiter\'s batch of edits is pending waits through every edit, and goes ahead one edit gap after the last', () => {
  reset();
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE });
  const t = clock();
  let told = null;
  const secondFile = join(crate, 'src', 'other.rs').replace(/\\/g, '/');
  const EDIT_EVERY_MS = 10 * SECOND;
  const EDITS = 3;
  let edits = 0;
  let sinceEdit = 0;
  const sleep = (ms) => {
    t.sleep(ms);
    sinceEdit += ms;
    if (edits < EDITS && sinceEdit >= EDIT_EVERY_MS) { edits += 1; sinceEdit = 0; settleWindows({ file: edits % 2 ? file : secondFile, writer: WAITER, now: t.now() }); }
  };
  const result = waitOutWindows({ scope: [crate], writer: BUILDER, onWait: (w) => { told = w; }, sleep, now: t.now });
  assert.equal(told.writer, WAITER, 'B named the writer it yielded to');
  assert.equal(edits, EDITS, 'B was still waiting at every edit of the batch: none found a build holding the crate');
  assert.ok(result.waitedMs >= (EDITS * EDIT_EVERY_MS) + (EDIT_GAP_S * SECOND) - SECOND && result.waitedMs < START_WAIT_S * SECOND, `B waited ${result.waitedMs} ms: the batch, then one edit gap`);
});

test('a landed edit shortens the writer\'s window to the edit gap and joins the edited file; a writer with no window opens none', () => {
  reset();
  const secondFile = join(crate, 'src', 'other.rs').replace(/\\/g, '/');
  settleWindows({ file, writer: WAITER });
  assert.equal(windowFor({ file }), null, 'control: an edit with no window opens none');
  const now = Date.now();
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now });
  settleWindows({ file: secondFile, writer: WAITER, now: now + SECOND });
  assert.equal(windowFor({ file, now: now + SECOND }).until, now + (1 + EDIT_GAP_S) * SECOND, 'the free window now ends one edit gap after the edit');
  assert.equal(windowFor({ file, now: now + SECOND }).kind, KIND.FREE, 'its kind and start time are kept');
  assert.equal(windowFor({ file: secondFile, now: now + SECOND }).writer, WAITER, 'the edited file gained a window');
  assert.equal(blockingWindows({ scope: [crate], writer: WAITER, now: now + SECOND }).length, 0, 'control: the writer\'s own build is not held');
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: now + (EDIT_GAP_S + 2) * SECOND }).length, 0, 'control: the window lapses one edit gap after the last edit');
});

test('an edit in flight keeps the writer\'s windows open until it lands, never shorter, and opens none (KIT-T1404)', () => {
  reset();
  const now = Date.now();
  holdWindowsInFlight({ writer: WAITER, now });
  assert.equal(windowFor({ file, now }), null, 'control: a writer with no window opens none');
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now });
  holdWindowsInFlight({ writer: WAITER, now: now + 6 * SECOND });
  assert.equal(windowFor({ file, now }).until, now + (6 + IN_FLIGHT_S) * SECOND, 'the guard passed the first edit at +6 s: the window runs IN_FLIGHT_S from then');
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: now + 100 * SECOND }).length, 1, 'a build at +100 s, while the edit is still in the hooks, yields');
  settleWindows({ file, writer: WAITER, now: now + 101 * SECOND });
  assert.equal(windowFor({ file, now: now + 101 * SECOND }).until, now + (101 + EDIT_GAP_S) * SECOND, 'the edit landed at +101 s: one edit gap after it');
  openWindow({ file, writer: WAITER, seconds: 10 * IN_FLIGHT_S, kind: KIND.FREE, now });
  holdWindowsInFlight({ writer: WAITER, now });
  assert.equal(windowFor({ file, now }).until, now + 10 * IN_FLIGHT_S * SECOND, 'a longer window is never shortened by an edit in flight');
});

test('a batch keeps the writer\'s windows across files, and a build start waits long enough for it (KIT-T1408)', () => {
  reset();
  const now = Date.now();
  const secondFile = join(crate, 'src', 'other.rs').replace(/\\/g, '/');
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now });
  holdWindowsInFlight({ writer: WAITER, now: now + 10 * SECOND });
  settleWindows({ file: secondFile, writer: WAITER, now: now + 20 * SECOND });
  holdWindowsInFlight({ writer: WAITER, now: now + 25 * SECOND });
  assert.equal(windowFor({ file: secondFile, now: now + 25 * SECOND }).batchStart, now + 10 * SECOND, 'the second file joins the batch begun by the first edit');
  assert.equal(windowFor({ file: secondFile, now: now + 25 * SECOND }).idleMs, 5 * SECOND, 'the gap from the landing to the next pass is idle');
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: now + 100 * SECOND }).length >= 1, true, 'a build at +100 s, inside the batch, yields');
  assert.ok(START_WAIT_S >= BATCH_CEILING_S + EDIT_GAP_S, 'a build start waits long enough for a started batch to land and settle');
});

test('slow hooks: a batch whose every edit spends 120 s in the hooks keeps its hold to the last landing (KIT-T1425)', () => {
  reset();
  const now = Date.now();
  const files = ['relief', 'kinds', 'projections', 'portico'].map((n) => join(crate, 'src', `${n}.rs`).replace(/\\/g, '/'));
  const HOOK_MS = 120 * SECOND;
  const GAP_MS = 4 * SECOND;
  openWindow({ file: files[0], writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now });
  let at = now + 12 * SECOND;
  for (const f of files) {
    holdWindowsInFlight({ writer: WAITER, now: at });
    assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: at + HOOK_MS - SECOND }).length >= 1, true, `a build while ${f} is still in its hooks yields`);
    at += HOOK_MS;
    settleWindows({ file: f, writer: WAITER, now: at });
    at += GAP_MS;
  }
  const lastLanding = at - GAP_MS;
  assert.ok(lastLanding - now > 120 * SECOND * files.length, 'the batch ran far past the old wall-clock cap');
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: lastLanding + (EDIT_GAP_S - 1) * SECOND }).length >= 1, true, 'the hold lasts one edit gap past the last landing');
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: lastLanding + (EDIT_GAP_S + 1) * SECOND }).length, 0, 'control: then it lapses');
});

test('control: a batch that spends BATCH_IDLE_S idle stops extending, and none outlives BATCH_CEILING_S', () => {
  reset();
  const now = Date.now();
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now });
  let at = now;
  const IDLE_STEP_MS = (EDIT_GAP_S - 1) * SECOND;
  holdWindowsInFlight({ writer: WAITER, now: at });
  while ((windowFor({ file, now: at })?.idleMs ?? 0) < BATCH_IDLE_S * SECOND) {
    at += SECOND;
    settleWindows({ file, writer: WAITER, now: at });
    at += IDLE_STEP_MS;
    holdWindowsInFlight({ writer: WAITER, now: at });
  }
  assert.equal(windowFor({ file, now: at }).until, at - IDLE_STEP_MS + EDIT_GAP_S * SECOND, 'the idle budget is spent: the edit in flight keeps only the landing\'s edit gap');
  reset();
  openWindow({ file, writer: WAITER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now });
  const LAND_MS = 10 * SECOND;
  for (at = now; at < now + 2 * BATCH_CEILING_S * SECOND; at += 2 * LAND_MS) {
    holdWindowsInFlight({ writer: WAITER, now: at });
    settleWindows({ file, writer: WAITER, now: at + LAND_MS });
  }
  assert.equal(blockingWindows({ scope: [crate], writer: BUILDER, now: now + BATCH_CEILING_S * SECOND }).length, 0, 'no batch holds past the ceiling, however busy');
});

test('the in-flight hold covers one edit\'s PreToolUse and PostToolUse hook limits', () => {
  assert.equal(IN_FLIGHT_S * SECOND, 2 * LONG_LIMIT_MS);
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
  assert.match(out, new RegExp(`For ${FREE_WINDOW_S}s no other writer's build`));
});

test.after(() => {
  rmSync(slots, { recursive: true, force: true });
});
