// recheck-idle.test.mjs — the idle re-check of deferred failures neither spins nor competes (KIT-T539, KIT-T540):
// an entry whose command selects no test is judged once per HEAD move, and no re-check starts while
// any lane of the checkout has a queued or running job (every lane shares one CARGO_TARGET_DIR).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs, withLane } from './config.mjs';
import { addDeferred, listDeferred, recheckDeferred } from './deferred.mjs';
import { writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';

// Appends a line to runs.txt each time it executes, and prints a nextest-style "no tests" line.
const COUNTING = `node -e "require('fs').appendFileSync('runs.txt','x\\n');console.log('error: no tests to run')"`;
const runs = (root) => (existsSync(join(root, 'runs.txt')) ? readFileSync(join(root, 'runs.txt'), 'utf8').split('\n').filter(Boolean).length : 0);
const entry = (cmd, extra = {}) => ({ repo: 'app', test: 't_none', cmd, job: 'j-old', reason: 'r', dirty: [], head: '0'.repeat(40), ...extra });

test('an entry whose command selects no test runs once per HEAD move, not on every idle check', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'a.txt', 'a\n', 'a');
    addDeferred(s.cfg, [entry(COUNTING)]);
    const first = recheckDeferred(s.cfg);
    recheckDeferred(s.cfg);
    recheckDeferred(s.cfg);
    assert.deepEqual(first.kept, ['t_none']);
    assert.equal(runs(s.root), 1, 'spawned exactly once with no HEAD move');
    assert.equal(listDeferred(s.cfg).length, 1, 'the entry is kept');
  } finally { s.done(); }
});

test('control: a HEAD move re-arms the entry', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'a.txt', 'a\n', 'a');
    addDeferred(s.cfg, [entry(COUNTING)]);
    recheckDeferred(s.cfg);
    commitOnMain(s.root, 'b.txt', 'b\n', 'b');
    recheckDeferred(s.cfg);
    assert.equal(runs(s.root), 2);
  } finally { s.done(); }
});

test('a dirty path that turns clean re-arms an unrun entry once, not forever', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'a.txt', 'a\n', 'a');
    writeFileSync(join(s.root, 'a.txt'), 'edited\n');
    addDeferred(s.cfg, [entry(COUNTING, { dirty: ['a.txt'], head: g(['rev-parse', 'HEAD'], s.root) })]);
    writeFileSync(join(s.root, 'a.txt'), 'a\n');
    recheckDeferred(s.cfg);
    recheckDeferred(s.cfg);
    assert.equal(runs(s.root), 1);
  } finally { s.done(); }
});

function twoLanes() {
  const t = setup();
  commitOnMain(t.root, 'a.txt', 'a\n', 'a');
  addDeferred(laneConfigs(t.cfg)[0], [entry(COUNTING, { repo: 'super' })]);
  return t;
}

test('a queued job in another lane means the root re-check does not start', () => {
  const t = twoLanes();
  try {
    const [root, sub] = laneConfigs(t.cfg);
    writeJob(sub, { ...buildPatchJob(t.cfg, { repo: 'rapid-game' }, '*** write p.txt\np\n').job, commands: [PASS] });
    const out = recheckDeferred(root);
    assert.deepEqual(out, { dropped: [], filed: [], kept: [] });
    assert.equal(runs(t.root), 0, 'the re-check command never ran');
  } finally { t.done(); }
});

test('another lane running a job (inflight journal) means the re-check does not start', () => {
  const t = twoLanes();
  try {
    const [root, sub] = laneConfigs(t.cfg);
    const home = brokerPaths(sub).home;
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'inflight.json'), JSON.stringify({ id: 'j-live', cwd: join(t.root, 'rapid-game'), startedAt: new Date().toISOString(), entries: [] }));
    recheckDeferred(root);
    assert.equal(runs(t.root), 0);
  } finally { t.done(); }
});

test('control: with every lane idle the root re-check runs', () => {
  const t = twoLanes();
  try {
    recheckDeferred(withLane(t.cfg, null));
    assert.equal(runs(t.root), 1);
  } finally { t.done(); }
});
