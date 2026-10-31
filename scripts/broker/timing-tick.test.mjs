// timing-tick.test.mjs — the cadence applies a lever to a lane's top blocker, measures turnaround before and after,
// keeps or reverts it, logs it, and tickets only what no lever is working on (KIT-D121).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tunedBatchWindowMs } from './timing-correct.mjs';
import { timingTick } from './timing-tick.mjs';
import { blockersReport } from './timing-report.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const S = 1000;
const H = 3600 * S;
const T = Date.parse('2026-10-30T12:00:00Z');

function fixture(batchWindowMs = 0) {
  const root = tempDir('timing-tick-');
  const cfg = { root, targetDir: join(root, 'target'), repos: [], lane: null, batchWindowMs };
  mkdirSync(join(cfg.targetDir, 'broker', 'results'), { recursive: true });
  return { root, cfg };
}

function job(cfg, finishedAt, turnaroundMs, n) {
  const id = `j-${(finishedAt - turnaroundMs).toString(36)}-${n}`;
  const result = { id, repo: 'r', status: 'passed', startedAt: new Date(finishedAt - 210 * S).toISOString(), finishedAt: new Date(finishedAt).toISOString(), diffStat: '', timings: [{ phase: 'run', ms: 210 * S }], commands: [{ cmd: 'cargo t -p a --lib', exit: 0, durationMs: 10 * S, slotWaitMs: 200 * S, log: join(cfg.root, `none-${n}.log`) }] };
  writeFileSync(join(cfg.targetDir, 'broker', 'results', `${id}.json`), JSON.stringify(result));
}

const history = (cfg) => { for (let i = 0; i < 4; i++) job(cfg, T - (i + 1) * 10 * 60 * S, 300 * S, `b${i}`); };
const later = (cfg, turnaroundMs) => { for (let i = 0; i < 4; i++) job(cfg, T + H + i * 10 * 60 * S, turnaroundMs, `a${i}`); };
const recorder = () => { const calls = []; return { calls, fileBug: (b) => { calls.push(b); return { id: 'KIT-T1' }; }, comment: (c) => { calls.push({ comment: c }); return { id: 'KIT-T1' }; } }; };
const corrections = (cfg) => readFileSync(join(cfg.targetDir, 'broker', 'corrections.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('a lane whose top blocker is the slot queue gets the batch window; the queue is not ticketed while it is worked on', () => {
  const { root, cfg } = fixture();
  try {
    history(cfg);
    const rec = recorder();
    const done = timingTick(cfg, { now: T, ...rec });
    assert.deepEqual(done.events.map((e) => `${e.lever} ${e.decision}`), ['batch-window applied']);
    assert.equal(tunedBatchWindowMs(cfg), 200 * S);
    assert.ok(rec.calls.length > 0 && rec.calls.every((c) => !c.shape.endsWith('|phase|queue')), 'the queue has a lever on it, so it is not a ticket');
    assert.ok(rec.calls.some((c) => c.shape.includes('|crate|a')), 'what no lever works on is ticketed');
    assert.equal(timingTick(cfg, { now: T + 1000, ...rec }), null, 'not due again within the cadence');
  } finally { cleanup(root); }
});

test('a correction that cut turnaround is kept and logged', () => {
  const { root, cfg } = fixture();
  try {
    history(cfg);
    timingTick(cfg, { now: T, ...recorder() });
    later(cfg, 100 * S);
    const done = timingTick(cfg, { now: T + 2 * H, ...recorder() });
    assert.equal(done.events[0].decision, 'kept');
    assert.equal(tunedBatchWindowMs(cfg), 200 * S);
    assert.deepEqual(corrections(cfg).map((r) => r.decision), ['applied', 'kept']);
  } finally { cleanup(root); }
});

test('a correction that did not cut turnaround is reverted, logged, and the queue is ticketed again', () => {
  const { root, cfg } = fixture();
  try {
    history(cfg);
    timingTick(cfg, { now: T, ...recorder() });
    later(cfg, 600 * S);
    const rec = recorder();
    const done = timingTick(cfg, { now: T + 2 * H, ...rec });
    assert.equal(done.events[0].decision, 'reverted');
    assert.equal(tunedBatchWindowMs(cfg), 0);
    assert.deepEqual(corrections(cfg).map((r) => r.decision), ['applied', 'reverted']);
    assert.ok(rec.calls.some((c) => c.shape?.endsWith('|phase|queue')), 'nothing is working on the queue now, so it is a ticket');
  } finally { cleanup(root); }
});

test('negative controls: a hand-set batch window is left alone, and a lane with no history does nothing', () => {
  const hand = fixture(5 * S);
  const empty = fixture();
  try {
    history(hand.cfg);
    assert.deepEqual(timingTick(hand.cfg, { now: T, ...recorder() }).events, []);
    assert.equal(tunedBatchWindowMs(hand.cfg), 0);
    assert.deepEqual(timingTick(empty.cfg, { now: T, ...recorder() }).events, []);
  } finally { cleanup(hand.root); cleanup(empty.root); }
});

test('a blocker that drops out of the top gets a comment on its ticket', () => {
  const { root, cfg } = fixture();
  try {
    history(cfg);
    const rec = recorder();
    timingTick(cfg, { now: T, ...rec });
    const comments = [];
    timingTick(cfg, { now: T + 200 * H, ...rec, comment: (c) => { comments.push(c); return null; } });
    assert.ok(comments.length > 0 && /no longer a top blocker/.test(comments[0].text));
  } finally { cleanup(root); }
});

test('the blockers report prints the ranked rows with their trend', () => {
  const { root, cfg } = fixture();
  try {
    history(cfg);
    const { text } = blockersReport(cfg, { now: T });
    assert.match(text, /^broker blockers \(waste first\)/);
    assert.match(text, /1\. phase queue in .*\/root: .* new /m);
  } finally { cleanup(root); }
});
