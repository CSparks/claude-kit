// build-grant.test.mjs — how many cores of the machine budget a build is granted (KIT-D135).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ELASTIC_GRANT, RAMP_MS, grantFor } from './build-grant.mjs';

const GIB = 2 ** 30;
const NOW = Date.parse('2026-11-07T12:00:00Z');
const old = (jobs) => ({ jobs, ts: new Date(NOW - 10 * RAMP_MS).toISOString() });
const fresh = (jobs) => ({ jobs, ts: new Date(NOW - 1000).toISOString() });
const BUDGET = 14;

test('an idle machine grants the request, clamped to the budget', () => {
  assert.equal(grantFor({ requested: 24, budget: BUDGET, held: [], now: NOW }), BUDGET);
  assert.equal(grantFor({ requested: 6, budget: BUDGET, held: [], now: NOW }), 6);
  assert.equal(grantFor({ budget: BUDGET, held: [], now: NOW }), BUDGET);
});

test('a fixed build waits until all it asked for is free', () => {
  assert.equal(grantFor({ requested: 8, budget: BUDGET, held: [old(8)], now: NOW }), 0);
  assert.equal(grantFor({ requested: 6, budget: BUDGET, held: [old(8)], now: NOW }), 6);
});

test('an elastic build takes what is free once the minimum is', () => {
  assert.equal(grantFor({ requested: 24, elastic: true, budget: BUDGET, held: [old(8)], now: NOW }), 6);
  assert.equal(grantFor({ requested: 24, elastic: true, budget: BUDGET, held: [old(BUDGET - MIN_ELASTIC_GRANT + 1)], now: NOW }), 0);
  assert.equal(grantFor({ requested: 2, elastic: true, budget: BUDGET, held: [old(BUDGET - 2)], now: NOW }), 2);
});

test('memory: builds not yet visible in free commit are charged, and low commit holds a build back', () => {
  const lowCommit = 16 * GIB;
  assert.equal(grantFor({ requested: 4, budget: BUDGET, held: [old(2)], commitFreeBytes: lowCommit, now: NOW }), 4);
  assert.equal(grantFor({ requested: 4, budget: BUDGET, held: [old(2)], commitFreeBytes: 3 * GIB, now: NOW }), 0);
  assert.equal(grantFor({ requested: 4, budget: BUDGET, held: [fresh(2)], commitFreeBytes: lowCommit, now: NOW }), 0, 'a fresh hold is charged 8 GiB of the 16 free');
});

test('low memory never starves the first build', () => {
  assert.equal(grantFor({ requested: 8, budget: BUDGET, held: [], commitFreeBytes: 0, now: NOW }), 8);
});
