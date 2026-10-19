// suite-yield.test.mjs — a full suite never holds a queued job (KIT-T504): a suite put off past the
// landing or hour bound still waits for an empty queue and reports itself overdue, and a job that
// arrives while a suite command runs cancels it within one poll.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, normalizeBroker } from './config.mjs';
import { ensureDirs, listQueue, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { runSuite, suiteLine, suiteState } from './suite.mjs';
import { fixture, g } from './patchkit.mjs';

const OK = 'node -e "0" --';
const A = 'node -e "process.exit(0)"';
const HOUR = 3600_000;
const LATE_JOB_MS = 700;
const POLL_MS = 100;
const CANCEL_BOUND_MS = 15_000;

const setup = (extra = {}) => {
  const s = fixture();
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: [A], suite: [A], land_gate: 'affected', suite_every: 1, affected: { check: OK, test: OK }, ...extra });
  ensureDirs(s.cfg);
  const queueJob = () => writeJob(s.cfg, { ...buildPatchJob(s.cfg, { ticket: 'T-1' }, '*** write q.md\nq\n').job, commands: [OK] });
  const commit = (msg) => g(['commit', '--allow-empty', '-m', msg], s.root);
  const unqueue = (id) => rmSync(join(brokerPaths(s.cfg).queue, `${id}.json`), { force: true });
  return { s, queueJob, commit, unqueue };
};

test('a suite put off past the hour bound still runs nothing while a job is queued, and says it is overdue', () => {
  const t = setup();
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    t.queueJob();
    const t0 = Date.now();
    assert.equal(runSuite(t.s.cfg, { now: t0 }), null);
    assert.equal(runSuite(t.s.cfg, { now: t0 + 3 * HOUR, fileBug: () => {} }), null, 'past 2 h, the queued job still comes first');
    assert.equal(suiteState(t.s.cfg).partial, undefined, 'nothing ran');
    assert.match(suiteLine(t.s.cfg, t0 + 3 * HOUR), /OVERDUE/);
    assert.doesNotMatch(suiteLine(t.s.cfg, t0), /OVERDUE/, 'under the bound');
  } finally { t.s.done(); }
});

test('a suite put off past the landing bound runs nothing while a job is queued', () => {
  const t = setup({ suite_max_landings: 3 });
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    t.queueJob();
    const now = Date.now();
    assert.equal(runSuite(t.s.cfg, { now }), null);
    assert.doesNotMatch(suiteLine(t.s.cfg), /OVERDUE/, 'one landing is under the bound');
    for (const m of ['two', 'three', 'four']) t.commit(m);
    assert.equal(runSuite(t.s.cfg, { now, fileBug: () => {} }), null);
    assert.match(suiteLine(t.s.cfg), /OVERDUE/);
  } finally { t.s.done(); }
});

test('control: an empty queue runs an overdue suite to the end and clears the overdue mark', () => {
  const t = setup({ suite_max_landings: 1 });
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    const queued = t.queueJob();
    const now = Date.now();
    assert.equal(runSuite(t.s.cfg, { now }), null);
    t.commit('two');
    assert.equal(runSuite(t.s.cfg, { now }), null);
    assert.match(suiteLine(t.s.cfg), /OVERDUE/);
    t.unqueue(queued.id);
    assert.equal(runSuite(t.s.cfg, { now, fileBug: () => {} }).status, 'passed');
    assert.doesNotMatch(suiteLine(t.s.cfg), /OVERDUE/);
  } finally { t.s.done(); }
});

test('a job queued while a suite command runs cancels it within one poll', () => {
  const t = setup();
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    const late = join(brokerPaths(t.s.cfg).queue, 'j-late.json').split('\\').join('/');
    t.s.cfg.suite = [`node -e "setTimeout(()=>require('fs').writeFileSync('${late}','{}'),${LATE_JOB_MS});setTimeout(()=>{},60000)"`];
    const started = Date.now();
    const out = runSuite(t.s.cfg, { pollMs: POLL_MS, fileBug: () => {} });
    assert.equal(out.status, 'cancelled');
    assert.ok(Date.now() - started < CANCEL_BOUND_MS, `cancelled after ${Date.now() - started} ms`);
    assert.equal(listQueue(t.s.cfg).length, 1);
  } finally { t.s.done(); }
});
