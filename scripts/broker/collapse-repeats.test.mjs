// collapse-repeats.test.mjs — runs of the same line print once with a count; a real error line is never folded away (KIT-D116).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseRepeats, heartbeatKey, repeatPrinter } from './collapse-repeats.mjs';

const WALL = 412;

test('a Compiling wall becomes one counted line naming the last crate', () => {
  const wall = Array.from({ length: WALL }, (_, i) => `   Compiling crate-${i} v0.1.${i}`);
  assert.deepEqual(collapseRepeats([...wall, '    Finished dev profile']), [`Compiling ×${WALL} (last: crate-${WALL - 1} v0.1.${WALL - 1})`, '    Finished dev profile']);
});

test('near-same progress lines (numbers differ) fold; two repeats stay as they are', () => {
  const ticks = ['queued, position 3', 'queued, position 3', 'queued, position 3', 'queued, position 3'];
  assert.deepEqual(collapseRepeats(ticks), ['queued, position 3 (repeated 4×)']);
  assert.deepEqual(collapseRepeats(['tick 1', 'tick 2']), ['tick 1', 'tick 2']);
  assert.deepEqual(collapseRepeats(['progress 10%', 'progress 20%', 'progress 30%']), ['progress 10% (repeated 3×)']);
});

test('negative control: a repeated real error line is never collapsed away', () => {
  const errors = ['error[E0432]: unresolved import `x`', 'error[E0432]: unresolved import `x`', 'error[E0432]: unresolved import `x`'];
  assert.deepEqual(collapseRepeats(errors), errors);
  const panics = ["thread 'a' panicked at src/lib.rs:1:1:", "thread 'a' panicked at src/lib.rs:1:1:", "thread 'a' panicked at src/lib.rs:1:1:", 'test a ... FAILED', 'test a ... FAILED', 'test a ... FAILED'];
  assert.deepEqual(collapseRepeats(panics), panics);
  const mixed = ['Compiling a v1', 'Compiling b v1', 'Compiling c v1', 'error: could not compile `c`', 'Compiling d v1'];
  assert.ok(collapseRepeats(mixed).includes('error: could not compile `c`'));
});

test('a cargo line that mentions "error" in a crate name is still progress', () => {
  const lines = ['Compiling error-chain v0.1', 'Compiling error-code v0.2', 'Compiling error-kit v0.3'];
  assert.deepEqual(collapseRepeats(lines), ['Compiling ×3 (last: error-kit v0.3)']);
});

test('repeatPrinter prints a line at once, folds its repeats, and tallies when the line changes or flushes', () => {
  const out = [];
  const p = repeatPrinter((l) => out.push(l), { key: heartbeatKey });
  for (let i = 0; i < 40; i++) p.line('wait: j-1 queued at position 3 of 5');
  p.line('wait: j-1 queued at position 2 of 5');
  p.flush();
  assert.deepEqual(out, ['wait: j-1 queued at position 3 of 5', 'wait: j-1 queued at position 3 of 5 (repeated 40×)', 'wait: j-1 queued at position 2 of 5']);
});

test('negative control: repeatPrinter never folds a repeated error line', () => {
  const out = [];
  const p = repeatPrinter((l) => out.push(l));
  for (let i = 0; i < 3; i++) p.line('error: boom');
  p.flush();
  assert.equal(out.length, 3);
});
