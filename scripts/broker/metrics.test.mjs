// metrics.test.mjs — broker stats from fixture result JSONs (KIT-T506): queue wait, phase minutes,
// failure/red rates, batches, per-session fairness, stall kills, recover/retry counts, and the
// ST-T904 share (greens waiting within 1.5x the single-job wall time). Control: a fast queue meets
// the target for every green, a slow one for none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metrics, parseSince, rollupLine, statsReport } from './metrics.mjs';
import { normalizeBroker } from './config.mjs';
import { ensureDirs } from './result.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, tempDir } from './testkit.mjs';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const S = 1000;
const id = (ms, tag = 'x') => `j-${ms.toString(36)}-${tag}`;
const iso = (ms) => new Date(ms).toISOString();
const job = (sub, start, end, extra = {}) => ({
  id: id(sub, extra.tag || 'x'), startedAt: iso(start), finishedAt: iso(end), status: 'landed',
  commands: [{ cmd: 'cargo check --workspace', exit: 0, durationMs: 60 * S }, { cmd: 'cargo test -p app', exit: 0, durationMs: 120 * S }], ...extra,
});

const OWN = { cmd: 'cargo test -p app', exit: 0, durationMs: 100 * S };

test('waits, phase minutes, rates, batches, sessions, stall kills and retries aggregate from results', () => {
  const m = metrics([
    job(T0, T0 + 10 * S, T0 + 190 * S, { session: 'a', timings: [{ phase: 'gate', ms: 30 * S }, { phase: 'run', ms: 150 * S }] }),
    job(T0, T0 + 190 * S, T0 + 370 * S, { session: 'b', status: 'failed', commands: [{ cmd: 'cargo test', exit: 101, durationMs: 60 * S }], killed: { pid: 1 }, revision: 2 }),
    job(T0, T0 + 370 * S, T0 + 400 * S, { session: 'a', train: { id: 't1', size: 3 }, recovered: true }),
    job(T0, T0 + 370 * S, T0 + 400 * S, { session: 'a', train: { id: 't1', size: 3 }, tag: 'y' }),
  ]);
  assert.equal(m.jobs, 4);
  assert.equal(m.greens, 3);
  assert.deepEqual([m.phases.buildMin, m.phases.testMin, m.phases.gateMin], [2, 5, 0.5], 'the train t1 counts its commands once');
  assert.equal(m.rates.failurePct, 25);
  assert.equal(m.rates.redPct, 25);
  assert.deepEqual([m.batches.trains, m.batches.meanSize, m.batches.maxSize], [1, 3, 3]);
  assert.equal(m.stallKills, 1);
  assert.equal(m.recovered, 1);
  assert.equal(m.retries, 1);
  assert.equal(m.sessions.rows.find((s) => s.session === 'a').jobs, 3);
  assert.ok(m.sessions.spread > 1, 'session b waited longer than session a');
});

test('ST-T904: a queue whose greens wait within 1.5x the single-job time meets it; a slow queue does not (control)', () => {
  const fast = metrics([job(T0, T0 + 10 * S, T0 + 100 * S, { commands: [OWN] }), job(T0 + 100 * S, T0 + 110 * S, T0 + 200 * S, { commands: [OWN] })]);
  assert.equal(fast.target.share, 100);
  const slow = metrics([job(T0, T0, T0 + 100 * S, { commands: [OWN] }), job(T0, T0 + 100 * S, T0 + 200 * S, { commands: [OWN] }), job(T0, T0 + 200 * S, T0 + 300 * S, { commands: [OWN] }), job(T0, T0 + 300 * S, T0 + 400 * S, { tag: 'z', commands: [OWN] })]);
  assert.equal(slow.target.singleS, 100);
  assert.equal(slow.target.meeting, 2, 'waits of 0 and 100 s are within 150 s; 200 and 300 s are not');
  assert.equal(slow.target.share, 50);
});

test('statsReport reads the results dir, honours --since, and rollupLine is null for an idle window', () => {
  const root = tempDir('metrics-');
  try {
    const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }] });
    const p = ensureDirs(cfg);
    const old = job(T0 - 3 * 24 * 3600 * S, T0 - 3 * 24 * 3600 * S, T0 - 3 * 24 * 3600 * S + 60 * S);
    const fresh = job(T0, T0 + S, T0 + 61 * S, { tag: 'f' });
    for (const r of [old, fresh]) writeFileSync(join(p.results, `${r.id}.json`), JSON.stringify(r));
    assert.equal(statsReport(cfg, { now: T0 + 3600 * S }).data.jobs, 2);
    assert.equal(statsReport(cfg, { since: '24h', now: T0 + 3600 * S }).data.jobs, 1);
    assert.match(rollupLine(cfg, T0 + 3600 * S), /broker 24h: 1 jobs \(1 green\).*ST-T904 100% of greens within 1.5x/);
    assert.equal(rollupLine(cfg, T0 + 10 * 24 * 3600 * S), null);
    assert.equal(parseSince('2h', T0), T0 - 2 * 3600 * S);
  } finally { cleanup(root); }
});
