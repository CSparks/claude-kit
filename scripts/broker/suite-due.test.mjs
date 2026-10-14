// suite-due.test.mjs — a busy queue never starves the suite (KIT-T483): once suite_every landings
// have accumulated, the suite runs before the next queued job, and it is not cancelled by it.
// One build per job (batch: 1) so the cadence is visible between landings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const PASS = 'node -e "0"';

// Every command appends its tag and the HEAD it ran on, so the order of jobs and suite runs is visible.
function setup(suiteEvery) {
  const s = fixture();
  const dir = tempDir('suite-due-');
  const log = join(dir, 'order').replace(/\\/g, '/');
  const rec = (tag) => `node -e "const h=require('child_process').execSync('git rev-parse --short HEAD').toString().trim();require('fs').appendFileSync('${log}','${tag} '+h+'\\n')"`;
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], land_gate: 'affected', suite_every: suiteEvery, suite: [rec('SUITE')], affected: { check: PASS, test: PASS }, batch: 1 });
  const order = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => l.trim().split(' ')[0]) : []);
  const queueLandings = (n) => {
    for (let i = 0; i < n; i++) {
      const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: `note ${i}`, land: true }, `*** write notes-${i}.md\nx\n`);
      writeJob(s.cfg, { ...job, id: `${job.id}-${i}`, commands: [rec('JOB')] });
    }
  };
  return { s, order, queueLandings, done: () => { cleanup(dir); s.done(); } };
}

test('with three landings queued back to back and suite_every 2, the suite runs before the third job', () => {
  const t = setup(2);
  try {
    processOnce(t.s.cfg);
    assert.deepEqual(t.order(), ['SUITE'], 'the first idle tick runs it on HEAD');
    t.queueLandings(3);
    processOnce(t.s.cfg);
    assert.deepEqual(t.order(), ['SUITE', 'JOB', 'JOB', 'SUITE', 'JOB'], 'due after two landings, it ran ahead of the queued third');
  } finally { t.done(); }
});

test('negative: below suite_every the queue is never held for the suite', () => {
  const t = setup(5);
  try {
    processOnce(t.s.cfg);
    t.queueLandings(3);
    processOnce(t.s.cfg);
    assert.deepEqual(t.order().slice(0, 4), ['SUITE', 'JOB', 'JOB', 'JOB'], 'no forced run inside the busy queue');
    assert.equal(g(['log', '--oneline', '-3'], t.s.root).split('\n').length, 3);
  } finally { t.done(); }
});
