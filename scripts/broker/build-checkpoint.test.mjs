// build-checkpoint.test.mjs — the check a long build gets (KIT-D137): what it says is building and why it is slow, and
// when it is stopped. Process lists and the clock are injected; no process runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkpointWatch } from './build-checkpoint.mjs';
import { readNote } from './build-note.mjs';

const ROOT = 4001;
const INTERVAL = 1000;
const HALF = 500;
const row = (pid, ppid, name, cpuMs, cmd = name) => ({ pid, ppid, name, cpuMs, cmd });
const compiling = [(cpu) => row(ROOT, process.pid, 'node.exe', cpu), (cpu) => row(4002, ROOT, 'cargo.exe', cpu, 'cargo test'), (cpu) => row(4003, 4002, 'rustc.exe', cpu, 'rustc --crate-name x')];
const idleTest = [(cpu) => row(ROOT, process.pid, 'node.exe', cpu), (cpu) => row(4002, ROOT, 'cargo.exe', cpu, 'cargo test'), (cpu) => row(4003, 4002, 'bike-1a2b.exe', cpu)];
const FOREIGN = row(900, 1, 'cargo.exe', 5, 'cargo check --workspace');

function harness({ shape = compiling, cpu = () => 0, foreign = [], limitMs = 60000, historyMs = 0, text = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'checkpoint-'));
  const logPath = join(dir, 'run.log');
  writeFileSync(logPath, text);
  const lines = [];
  let clock = 0;
  const watch = checkpointWatch({ logPath, pid: ROOT, limitMs, historyMs, intervalMs: INTERVAL, list: () => [row(process.pid, 1, 'node.exe', 0), ...shape.map((make) => make(cpu(clock))), ...foreign], own: () => [process.pid], say: (l) => lines.push(l) });
  const at = (ms) => { clock = ms; return watch.poll(ms); };
  return { dir, logPath, lines, at, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const CARGO_LOG = ['   Compiling bevy_ecs v0.19.0', '   Compiling rg-water v0.1.0 (D:\\x)', '   Compiling rg-rig-bevy v0.1.0 (D:\\y)', ''].join('\n');

test('the check names the crates building, cold or warm, the contenders, and says it is progressing', () => {
  const h = harness({ text: CARGO_LOG, cpu: (t) => t * 5, foreign: [FOREIGN] });
  try {
    assert.equal(h.at(0), null);
    assert.equal(h.at(HALF), null, 'the baseline sample is not a check');
    const check = h.at(INTERVAL);
    assert.equal(check.stop, undefined);
    assert.match(check.line, /^1 s check: compiling bevy_ecs, rg-water, rg-rig-bevy \(3 crates compiled so far\)/);
    assert.match(check.line, /cold: no passing run of this command on record/);
    assert.match(check.line, /slow because other cargo builds share the machine: pid 900 cargo check --workspace/);
    assert.match(check.line, /progressing \(log \+\d+ B, CPU \+/);
    assert.deepEqual(h.lines, [check.line]);
  } finally { h.done(); }
});

test('with history the line is warm and estimates the time left; past the last passing run it says so', () => {
  const h = harness({ text: CARGO_LOG, cpu: (t) => t * 5, historyMs: 4000 });
  try {
    h.at(HALF);
    assert.match(h.at(INTERVAL).line, /warm: the last passing run took 4 s, about 3 s left/);
    assert.match(h.at(2 * INTERVAL).line, /about 2 s left/);
    assert.match(h.at(5 * INTERVAL).line, /this run is past it/);
  } finally { h.done(); }
});

test('a build that prints nothing and uses no CPU is stopped at the check', () => {
  const h = harness({ text: CARGO_LOG });
  try {
    h.at(HALF);
    const check = h.at(INTERVAL);
    assert.match(check.stop, /no log output and no CPU in the build tree for 1 s/);
    assert.match(check.line, /STALLED, stopping the build/);
  } finally { h.done(); }
});

test('control: log output alone, or CPU alone, is progress', () => {
  const quiet = harness({ text: CARGO_LOG, cpu: (t) => t * 5 });
  const loud = harness({ text: CARGO_LOG });
  try {
    quiet.at(HALF);
    assert.equal(quiet.at(INTERVAL).stop, undefined, 'CPU alone');
    loud.at(HALF);
    appendFileSync(loud.logPath, '   Compiling rg-shader-kit v0.1.0\n');
    assert.equal(loud.at(INTERVAL).stop, undefined, 'log growth alone');
  } finally { quiet.done(); loud.done(); }
});

test('past its budget a command that prints nothing and runs no compiler is a hung test and is stopped', () => {
  const hung = harness({ shape: idleTest, cpu: (t) => t * 5, limitMs: 1500 });
  const building = harness({ shape: compiling, cpu: (t) => t * 5, limitMs: 1500 });
  const early = harness({ shape: idleTest, cpu: (t) => t * 5, limitMs: 60000 });
  try {
    for (const h of [hung, building, early]) { h.at(HALF); h.at(INTERVAL); }
    assert.equal(hung.at(2 * INTERVAL).stop, 'past its 2 s budget with no log output and no compiler running (a hung test)');
    assert.equal(building.at(2 * INTERVAL).stop, undefined, 'a compiler running is a build, not a hung test');
    assert.equal(early.at(2 * INTERVAL).stop, undefined, 'inside its budget a silent test with CPU runs on');
  } finally { hung.done(); building.done(); early.done(); }
});

test('a process list that cannot be read never stops a command on CPU alone, but a silent one past its budget stops', () => {
  const h = harness({ shape: [], limitMs: 1500 });
  try {
    h.at(HALF);
    assert.equal(h.at(INTERVAL).stop, undefined, 'inside the budget');
    assert.match(h.at(2 * INTERVAL).stop, /no log output/, 'past the budget and silent');
  } finally { h.done(); }
});

test('by default the line goes to the log and the note file, and close() removes the note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'checkpoint-note-'));
  try {
    const logPath = join(dir, 'real.log');
    writeFileSync(logPath, CARGO_LOG);
    const watch = checkpointWatch({ logPath, pid: ROOT, limitMs: 60000, intervalMs: INTERVAL, list: () => compiling.map((make) => make(5000)), own: () => [] });
    watch.poll(INTERVAL);
    assert.match(readNote(logPath), /^1 s check: compiling/);
    assert.match(readFileSync(logPath, 'utf8'), /\n\[broker\] 1 s check: compiling/);
    watch.close();
    assert.equal(readNote(logPath), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
