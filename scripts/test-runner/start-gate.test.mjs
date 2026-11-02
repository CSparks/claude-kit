// start-gate.test.mjs — a budgeted run re-checks the real clock at every start (KIT-T839): a file that would end past
// budget x 1.25 is skipped, the test named for a changed module never is, and a file that fits starts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_GATE, startGate } from './start-gate.mjs';

const BUDGET_MS = 100_000;
const gateAt = (elapsedMs, reached = new Map()) => startGate({ budgetMs: BUDGET_MS, cost: () => 30_000, reached, started: 0, now: () => elapsedMs });

test('a file ending inside budget x 1.25 starts; one ending past it is skipped', () => {
  assert.equal(gateAt(95_000).skips('a.test.mjs'), false, 'ends at 125 s, exactly the limit');
  assert.equal(gateAt(95_001).skips('a.test.mjs'), true);
});

test('negative control: the nearest reached file (distance 0) starts however late; a farther reached file does not', () => {
  const reached = new Map([['own.test.mjs', 0], ['near.test.mjs', 1]]);
  assert.equal(gateAt(900_000, reached).skips('own.test.mjs'), false);
  assert.equal(gateAt(900_000, reached).skips('near.test.mjs'), true);
});

test('NO_GATE skips nothing', () => {
  assert.equal(NO_GATE.skips('any.test.mjs'), false);
});
