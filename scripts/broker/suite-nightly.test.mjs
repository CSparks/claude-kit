// suite-nightly.test.mjs — the nightly schedule (KIT-D110): the suite and the nightly tiers run once per slot
// after `nightly_at`, for a HEAD the last run did not cover; `suite_every` opts back into the landing cadence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { nightlySlot, runSuite, suiteState } from './suite.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const ran = (log) => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);

function setup(extra = {}) {
  const s = fixture();
  const dir = tempDir('suite-nightly-');
  const log = join(dir, 'order').replace(/\\/g, '/');
  const rec = (tag) => `node -e "require('fs').appendFileSync('${log}','${tag}\\n')"`;
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], land_gate: 'affected', suite: [rec('SUITE')], nightly: [rec('GPU'), rec('PERF')], ...extra });
  s.cfg.suiteSchedule = 'nightly';
  const land = (n) => commitOnMain(s.root, `n${n}.txt`, `${n}\n`, `landing ${n}`);
  return { s, log, land, run: (now) => runSuite(s.cfg, { fileBug: () => assert.fail('green expected'), now }), done: () => { cleanup(dir); s.done(); } };
}

test('the slot is the latest nightly_at not in the future', () => {
  const cfg = { nightlyAt: { hour: 2, minute: 0 } };
  assert.equal(nightlySlot(cfg, at(10, 10)), at(10, 2), 'after 02:00 the slot is today');
  assert.equal(nightlySlot(cfg, at(10, 1, 30)), at(9, 2), 'before 02:00 the slot is yesterday');
});

test('the suite and the nightly tiers run once per slot, in order, and only for a new HEAD', () => {
  const t = setup();
  try {
    assert.equal(t.run(at(10, 12)), null, 'first sight of the checkout: nothing runs until the next slot');
    t.land(1);
    assert.equal(t.run(at(11, 1)), null, 'before the slot');
    const out = t.run(at(11, 3));
    assert.equal(out.status, 'passed');
    assert.deepEqual(ran(t.log), ['SUITE', 'GPU', 'PERF'], 'suite first, then the tiers');
    t.land(2);
    assert.equal(t.run(at(11, 4)), null, 'one run per slot, new HEAD or not');
    assert.equal(t.run(at(12, 3)).status, 'passed', 'the next night runs the new HEAD');
    assert.equal(t.run(at(13, 3)), null, 'no new HEAD, no run');
    assert.equal(ran(t.log).length, 6);
    assert.ok(suiteState(t.s.cfg).lastRunAt);
  } finally { t.done(); }
});

test('suite_every opts out: the landing cadence applies and the nightly tiers stay off', () => {
  const t = setup({ suite_every: 1 });
  try {
    t.s.cfg.suiteSchedule = 'cadence';
    t.run(at(10, 12));
    t.land(1);
    assert.equal(t.run(at(10, 13)).status, 'passed', 'a landing is enough');
    assert.deepEqual(ran(t.log), ['SUITE', 'SUITE'], 'first sight and the landing each ran the suite alone: no nightly tiers on the cadence');
  } finally { t.done(); }
});
