// suite-starve.test.mjs — a suite put off past `suite_max_landings` or `suite_max_hours` runs its next
// unfinished command between jobs, and finished commands carry over (KIT-T504). Control: under
// light load the suite still yields to a queued job and runs nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBroker } from './config.mjs';
import { writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { runSuite, suiteState } from './suite.mjs';
import { ensureDirs } from './result.mjs';
import { fixture, g } from './patchkit.mjs';

const OK = 'node -e "0" --';
const A = 'node -e "process.exit(0)"';
const B = 'node -e "process.exit(0)" second';

const setup = (extra = {}) => {
  const s = fixture();
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: [A], suite: [A, B], land_gate: 'affected', suite_every: 1, affected: { check: OK, test: OK }, ...extra });
  ensureDirs(s.cfg);
  const queueJob = () => writeJob(s.cfg, { ...buildPatchJob(s.cfg, { ticket: 'T-1' }, '*** write q.md\nq\n').job, commands: [OK] });
  const commit = (msg) => g(['commit', '--allow-empty', '-m', msg], s.root);
  return { s, queueJob, commit };
};
const HOUR = 3600_000;

test('control: under light load a queued job holds the suite back, however many ticks pass', () => {
  const t = setup();
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    t.queueJob();
    const t0 = Date.now();
    assert.equal(runSuite(t.s.cfg, { now: t0 }), null);
    assert.equal(runSuite(t.s.cfg, { now: t0 + HOUR / 2 }), null, 'half an hour is under the 2 h bound');
    assert.equal(suiteState(t.s.cfg).partial, undefined, 'nothing ran');
  } finally { t.s.done(); }
});

test('a suite put off past the hour bound runs one command per tick between jobs, then completes', () => {
  const t = setup();
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    t.queueJob();
    const t0 = Date.now();
    assert.equal(runSuite(t.s.cfg, { now: t0 }), null);
    const first = runSuite(t.s.cfg, { now: t0 + 3 * HOUR, fileBug: () => {} });
    assert.equal(first.status, 'partial');
    assert.equal(suiteState(t.s.cfg).partial.commands.length, 1, 'the first command finished and is kept');
    const second = runSuite(t.s.cfg, { now: t0 + 3 * HOUR, fileBug: () => {} });
    assert.equal(second.status, 'passed');
    assert.equal(suiteState(t.s.cfg).putOff, undefined, 'the put-off marker clears once the suite completes');
  } finally { t.s.done(); }
});

test('a suite put off past the landing bound runs between jobs without any time passing', () => {
  const t = setup({ suite_max_landings: 3 });
  try {
    runSuite(t.s.cfg, { fileBug: () => {} });
    t.commit('one');
    t.queueJob();
    const now = Date.now();
    assert.equal(runSuite(t.s.cfg, { now }), null);
    t.commit('two'); t.commit('three');
    assert.equal(runSuite(t.s.cfg, { now }), null, 'two landings are under the bound');
    t.commit('four');
    assert.equal(runSuite(t.s.cfg, { now, fileBug: () => {} }).status, 'partial');
  } finally { t.s.done(); }
});
