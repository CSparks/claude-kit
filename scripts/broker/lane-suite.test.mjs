// lane-suite.test.mjs — a submodule lane with a `suite:` of its own runs it when the checkout is idle
// and files a regression on red (KIT-T559): the full rapid-game workspace moves off the pre-push gate
// to the idle cadence. Controls: a lane without `suite:` runs nothing, a green run files nothing, and
// a queued job in another lane cancels the run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { laneConfigs, normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { suiteLine, suiteState } from './suite.mjs';
import { setup } from './subkit.mjs';

const PASS = 'node -e "0"';
// Red while rapid-game holds bad.txt.
const SUITE = 'node -e "process.exit(require(\'fs\').existsSync(\'bad.txt\') ? 1 : 0)"';

function lanes(suite) {
  const t = setup();
  if (suite) t.broker.repos[1].suite = suite;
  t.cfg = normalizeBroker(t.root, t.broker);
  const [rootLane, subLane] = laneConfigs(t.cfg);
  const bugs = [];
  const land = (file) => {
    const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'RG-T1', title: `add ${file}`, land: true, 'no-pin': true }, `*** write ${file}\nx\n`);
    writeJob(subLane, { ...job, commands: [PASS] });
    const summary = processOnce(subLane, { fileBug: (b) => bugs.push(b) });
    return { result: readResult(subLane, job.id), summary };
  };
  return { ...t, rootLane, subLane, bugs, land };
}

test('a lane suite runs the lane\'s own command on the submodule HEAD at idle and files one regression on red', () => {
  const t = lanes(SUITE);
  try {
    const green = t.land('ok.txt');
    assert.equal(green.result.status, 'landed', JSON.stringify(green.result));
    assert.equal(green.summary.suite.status, 'passed', JSON.stringify(green.summary.suite));
    assert.deepEqual(t.bugs, [], 'a green run files nothing');
    const red = t.land('bad.txt');
    assert.equal(red.result.status, 'landed', 'the landing is not held by the idle suite');
    assert.equal(red.summary.suite.status, 'failed', JSON.stringify(red.summary.suite));
    assert.equal(t.bugs.length, 1);
    assert.equal(t.bugs[0].type, 'regression');
    assert.match(t.bugs[0].text, /full suite red at/);
    assert.match(t.bugs[0].text, /add bad\.txt/, 'names the landing that maps to the break');
    assert.equal(suiteState(t.subLane).lastGreen !== suiteState(t.subLane).lastRun, true);
    assert.match(suiteLine(t.subLane), /RED/);
  } finally { t.done(); }
});

test('controls: no suite: key, no run; a queued job in the root lane cancels the lane suite', () => {
  const none = lanes(null);
  try {
    assert.equal(none.land('ok.txt').summary.suite, null);
    assert.equal(suiteLine(none.subLane), null);
  } finally { none.done(); }

  const t = lanes(SUITE);
  try {
    const { job } = buildPatchJob(t.cfg, { ticket: 'ST-T1', title: 'game' }, '*** write game.txt\ng\n');
    writeJob(t.rootLane, { ...job, commands: [PASS] });
    const r = t.land('ok.txt');
    assert.equal(r.result.status, 'landed');
    assert.equal(r.summary.suite && r.summary.suite.cancelled, true, JSON.stringify(r.summary));
    writeFileSync(join(t.root, 'unused'), '');
  } finally { t.done(); }
});
