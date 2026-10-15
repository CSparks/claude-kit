// suite-due.test.mjs — a busy queue never starves the suite (KIT-T483): once suite_every landings
// have accumulated, the suite runs before the next queued job, and it is not cancelled by it.
// One build per job (batch: 1) so the cadence is visible between landings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { runSuite, suiteState } from './suite.mjs';
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

test('landings never wait for the suite: three queued landings run first, the suite after the queue drains', () => {
  const t = setup(2);
  try {
    processOnce(t.s.cfg);
    assert.deepEqual(t.order(), ['SUITE'], 'the first idle tick runs it on HEAD');
    t.queueLandings(3);
    processOnce(t.s.cfg);
    assert.deepEqual(t.order(), ['SUITE', 'JOB', 'JOB', 'JOB', 'SUITE'], 'due after two landings, yet it ran only once the queue was empty');
  } finally { t.done(); }
});

test('negative: below suite_every the suite does not run after the queue drains', () => {
  const t = setup(5);
  try {
    processOnce(t.s.cfg);
    t.queueLandings(3);
    processOnce(t.s.cfg);
    assert.deepEqual(t.order(), ['SUITE', 'JOB', 'JOB', 'JOB']);
    assert.equal(g(['log', '--oneline', '-3'], t.s.root).split('\n').length, 3);
  } finally { t.done(); }
});

test('a cancelled run keeps its finished commands for the same sha; another sha re-runs them', () => {
  for (const [sameSha, expected] of [[true, ['SUITE-2']], [false, ['SUITE-1', 'SUITE-2']]]) {
    const t = setup(1);
    try {
      const head = g(['rev-parse', 'HEAD'], t.s.root).trim();
      t.s.cfg.suite = [t.s.cfg.suite[0].replace('SUITE', 'SUITE-1'), t.s.cfg.suite[0].replace('SUITE', 'SUITE-2')];
      const id = `suite-${head.slice(0, 7)}`;
      const state = suiteState(t.s.cfg);
      const partial = { id: sameSha ? id : 'suite-0000000', commands: [{ cmd: t.s.cfg.suite[0], exit: 0, durationMs: 1, log: 'x' }] };
      ensureDirs(t.s.cfg);
      mkdirSync(join(t.s.cfg.targetDir, 'broker', 'suite'), { recursive: true });
      writeFileSync(join(t.s.cfg.targetDir, 'broker', 'suite', 'state.json'), JSON.stringify({ ...state, partial }));
      const out = runSuite(t.s.cfg, { fileBug: () => assert.fail('green expected') });
      assert.equal(out.status, 'passed');
      assert.deepEqual(t.order(), expected, `sameSha ${sameSha}`);
    } finally { t.done(); }
  }
});
