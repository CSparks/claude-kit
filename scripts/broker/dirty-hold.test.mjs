// dirty-hold.test.mjs — a lane paused on a dirty checkout stops asking for the subtree lock (KIT-T552 C):
// while rapid-game holds a hand edit, neither its own lane nor the root lane's idle work takes the
// tree poll after poll. Control: once the tree is clean the lane takes it and runs the job.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';
import { takesSoFar } from './subtree.mjs';

const POLLS = 6;

function dirtyLane() {
  const t = setup();
  writeFileSync(join(t.sub, 'api.rs'), 'original\n');
  g(['add', 'api.rs'], t.sub);
  g(['commit', '-m', 'api'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  const [rootLane, subLane] = laneConfigs(t.cfg);
  const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw' }, '*** write extra.txt\nnew\n');
  writeJob(subLane, { ...job, commands: [PASS] });
  writeFileSync(join(t.sub, 'api.rs'), 'hand edit\n');
  return { ...t, rootLane, subLane, job };
}

test('while the tree is dirty the paused lane and the other lane\'s idle work take the lock at most once over many polls', () => {
  const t = dirtyLane();
  try {
    const before = takesSoFar();
    const summaries = [];
    for (let i = 0; i < POLLS; i++) {
      summaries.push(processOnce(t.subLane));
      processOnce(t.rootLane);
    }
    assert.ok(takesSoFar() - before <= 1, `lock takes over ${POLLS} polls: ${takesSoFar() - before}`);
    assert.ok(summaries.every((s) => s.paused && s.pausedRepos.includes('rapid-game')), 'the lane stays paused on the dirty tree');
    assert.equal(readResult(t.subLane, t.job.id).status, 'dirty');
    assert.ok(existsSync(join(brokerPaths(t.subLane).home, 'dirty-hold.json')));
  } finally { t.done(); }
});

test('control: once the tree is clean the lane takes it, runs the job and clears the hold; idle work resumes', () => {
  const t = dirtyLane();
  try {
    for (let i = 0; i < 3; i++) { processOnce(t.subLane); processOnce(t.rootLane); }
    g(['checkout', '--', 'api.rs'], t.sub);
    const before = takesSoFar();
    const s = processOnce(t.subLane);
    assert.equal(s.paused, false);
    assert.equal(readResult(t.subLane, t.job.id).status, 'passed');
    assert.ok(takesSoFar() > before, 'the lane took the tree again');
    assert.ok(!existsSync(join(brokerPaths(t.subLane).home, 'dirty-hold.json')));
    const idleBefore = takesSoFar();
    processOnce(t.rootLane);
    assert.ok(takesSoFar() > idleBefore, 'the root lane\'s idle work takes the tree again');
  } finally { t.done(); }
});
