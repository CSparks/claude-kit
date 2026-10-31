// timing-profile.test.mjs — the rolling profile ranks time sinks biggest first against recent history, puts waste
// ahead of honest long work, and reads a trend per job, never against a fixed number of seconds (KIT-D121).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAUSED_QUEUE, blockerId, profile } from './timing-profile.mjs';
import { describe } from './timing-report.mjs';

const H = 3600000;
const NOW = 100 * H;
const sample = (at, entries, cache) => ({ id: `s${at}`, project: 'p', lane: 'root', at, turnaroundMs: 1, jobs: 1, entries, cache });
const e = (kind, key, ms) => ({ kind, key, ms });
const WINDOW = { now: NOW, windowMs: 24 * H };

test('rows rank biggest first within a kind, with share, rank and the previous rank', () => {
  const prev = sample(NOW - 30 * H, [e('phase', 'queue', 100), e('phase', 'compile', 400)]);
  const cur = sample(NOW - H, [e('phase', 'queue', 900), e('phase', 'compile', 100), e('phase', 'test', 50)]);
  const p = profile([prev, cur], WINDOW);
  assert.deepEqual(p.byKind.phase.map((r) => [r.key, r.rank, r.prevRank]), [['queue', 1, 2], ['compile', 2, 1], ['test', 3, 0]]);
  assert.equal(Math.round(p.byKind.phase[0].share * 100), 86);
});

test('trend compares per job, so twice the jobs at the same cost per job is flat, not worse', () => {
  const prev = [sample(NOW - 30 * H, [e('phase', 'compile', 100)])];
  const same = [sample(NOW - 2 * H, [e('phase', 'compile', 100)]), sample(NOW - H, [e('phase', 'compile', 100)])];
  assert.equal(profile([...prev, ...same], WINDOW).byKind.phase[0].trend, 'flat');
  const worse = [sample(NOW - H, [e('phase', 'compile', 150)])];
  const row = profile([...prev, ...worse], WINDOW).byKind.phase[0];
  assert.deepEqual([row.trend, Math.round(row.deltaPct)], ['worse', 50]);
  assert.equal(profile([...prev, sample(NOW - H, [e('phase', 'compile', 40)])], WINDOW).byKind.phase[0].trend, 'better');
  assert.equal(profile([sample(NOW - H, [e('phase', 'compile', 40)])], WINDOW).byKind.phase[0].trend, 'new');
});

test('top lists waste first, then the topN of each other kind', () => {
  const s = sample(NOW - H, [e('waste', 'rebuild lone', 50), e('phase', 'queue', 100), e('phase', 'compile', 800), e('crate', 'mid', 70), e('test', 'mid --lib', 60)]);
  const top = profile([s], { ...WINDOW, topN: 1 }).top;
  assert.deepEqual(top.map((r) => `${r.kind}:${r.key}`), ['waste:rebuild lone', 'phase:compile', 'crate:mid', 'test:mid --lib']);
});

test('the slot queue waste causes is estimated from the lane queue and waste\'s share of command time', () => {
  const s = sample(NOW - H, [e('phase', 'queue', 400), e('phase', 'compile', 300), e('phase', 'command', 100), e('waste', 'rebuild lone', 100)], { hits: 1, misses: 3 });
  const p = profile([s], WINDOW);
  const caused = p.byKind.waste.find((r) => r.key === CAUSED_QUEUE);
  assert.equal(Math.round(caused.ms), 100);
  assert.deepEqual(p.cache, { 'p|root': { hits: 1, misses: 3 } });
  assert.match(describe(caused), /waste slot queue caused by waste \(estimate\) in p\/root/);
});

test('control: samples outside both windows and an empty history rank nothing', () => {
  assert.deepEqual(profile([sample(NOW - 80 * H, [e('phase', 'queue', 9)])], WINDOW).top, []);
  assert.deepEqual(profile([], WINDOW).top, []);
  assert.equal(blockerId({ project: 'p', lane: 'root', kind: 'phase', key: 'queue' }), 'p|root|phase|queue');
});
