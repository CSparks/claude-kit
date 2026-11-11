// suite-approval.test.mjs — the daemon never starts a full suite itself (KIT-D160, KIT-D161, KIT-T1057): a due suite is
// recorded once as awaiting approval, with one line naming it and the approving command; an approved suite runs once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { approveSuite, runSuite, suiteLine, suiteState } from './suite.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const ran = (log) => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);

function setup(extra = {}) {
  const s = fixture();
  const dir = tempDir('suite-approval-');
  const log = join(dir, 'order').replace(/\\/g, '/');
  const rec = (tag) => `node -e "require('fs').appendFileSync('${log}','${tag}\\n')"`;
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], land_gate: 'affected', suite: [rec('SUITE')], suite_every: 1, ...extra });
  const land = (n) => commitOnMain(s.root, `n${n}.txt`, `${n}\n`, `landing ${n}`);
  return { s, log, land, done: () => { cleanup(dir); s.done(); } };
}

test('a due suite is deferred, not run: one line names it and how to approve, announced once per wait', () => {
  const t = setup();
  try {
    const first = runSuite(t.s.cfg, { fileBug: () => assert.fail('no bug expected') });
    assert.equal(first.status, 'deferred');
    assert.equal(first.deferred, true);
    assert.match(first.line, /full suite [0-9a-f]{7} is due and deferred: it runs only when approved \(node broker\.mjs approve-suite --root /);
    assert.deepEqual(ran(t.log), [], 'nothing ran');
    t.land(1);
    assert.equal(runSuite(t.s.cfg), null, 'announced already: a later landing and tick print nothing more');
    assert.deepEqual(ran(t.log), []);
    assert.match(suiteLine(t.s.cfg), /AWAITING APPROVAL for [0-9a-f]{7} since .*approve-suite --root/);
    assert.notEqual(suiteState(t.s.cfg).awaiting.sha, first.sha, 'the wait names the newest HEAD');
  } finally { t.done(); }
});

test('an idle daemon tick defers too: processOnce reports the deferral and runs no command', () => {
  const t = setup();
  try {
    const sum = processOnce(t.s.cfg);
    assert.equal(sum.suite.deferred, true);
    assert.deepEqual(ran(t.log), []);
    assert.equal(processOnce(t.s.cfg).suite, null, 'the second idle tick is silent');
  } finally { t.done(); }
});

test('control: an approved suite runs once, clears the wait, and the next due suite is deferred again', () => {
  const t = setup();
  try {
    assert.equal(runSuite(t.s.cfg).status, 'deferred');
    assert.equal(approveSuite(t.s.cfg), true);
    const out = runSuite(t.s.cfg, { fileBug: () => assert.fail('green expected') });
    assert.equal(out.status, 'passed');
    assert.deepEqual(ran(t.log), ['SUITE']);
    assert.equal(suiteState(t.s.cfg).approved, undefined, 'the approval is consumed');
    assert.equal(suiteState(t.s.cfg).awaiting, undefined);
    assert.doesNotMatch(suiteLine(t.s.cfg), /AWAITING/);
    t.land(2);
    assert.equal(runSuite(t.s.cfg).status, 'deferred', 'a second run needs a second approval');
    assert.deepEqual(ran(t.log), ['SUITE']);
  } finally { t.done(); }
});

test('control: nothing to approve without a suite scope', () => {
  const t = setup();
  try {
    assert.equal(approveSuite({ ...t.s.cfg, landGate: 'full' }), false);
  } finally { t.done(); }
});
