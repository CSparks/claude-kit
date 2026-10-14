// suite.test.mjs — the full-suite cadence (KIT-T472): it runs on HEAD after `suite_every`
// landings while the queue is idle, and a red run files one regression naming the range, the
// failing tests and the landing whose paths map to the failing target.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { failingTargets } from './suite-blame.mjs';
import { runSuite, suiteState } from './suite.mjs';
import { fixture, g } from './patchkit.mjs';

const OK = 'node -e "0" --';
// A libtest-shaped suite: alpha_case fails once camera.rs holds `y`.
const SUITE = `node -e "${[
  `const bad=require('fs').readFileSync('crates/app/src/camera.rs','utf8').includes('y');`,
  `console.log('     Running tests\\\\alpha.rs (target\\\\debug\\\\deps\\\\alpha-1.exe)');`,
  `console.log('test alpha_case ... '+(bad?'FAILED':'ok'));process.exit(bad?1:0)`,
].join('').replaceAll('"', '\\"')}"`;

const setup = (extra = {}) => {
  const s = fixture();
  const files = { 'crates/app/Cargo.toml': '[package]\nname = "app"\n', 'crates/app/src/camera.rs': 'x\n', 'crates/app/tests/alpha.rs': 'use app::camera;\n' };
  for (const [p, t] of Object.entries(files)) { mkdirSync(join(s.root, p, '..'), { recursive: true }); writeFileSync(join(s.root, p), t); }
  g(['add', '-A', 'crates'], s.root);
  g(['commit', '-m', 'crate'], s.root);
  g(['push', 'origin', 'main'], s.root);
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: [SUITE], land_gate: 'affected', suite_every: 2, affected: { check: OK, test: OK }, ...extra });
  const bugs = [];
  const fileBug = (b) => bugs.push(b);
  const land = (title, envelope) => {
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title, land: true }, envelope);
    writeJob(s.cfg, { ...job, commands: [SUITE] });
    const summary = processOnce(s.cfg, { fileBug });
    return { result: readResult(s.cfg, job.id), summary };
  };
  return { s, bugs, fileBug, land };
};

const CAMERA = '*** edit crates/app/src/camera.rs\n<<<<<<< SEARCH\nx\n=======\ny\n>>>>>>> REPLACE\n';

test('failingTargets maps a failed test to the target cargo was running', () => {
  const log = '     Running unittests src\\lib.rs (x)\ntest a::b ... ok\n     Running tests\\wall\\main.rs (y)\ntest w ... FAILED\n';
  assert.deepEqual(failingTargets(log), [{ test: 'w', spec: '--test wall' }]);
});

test('a red suite after two landings files one regression naming the camera landing as the likely cause', () => {
  const t = setup();
  try {
    const first = processOnce(t.s.cfg, { fileBug: t.fileBug });
    assert.equal(first.suite.status, 'passed', 'the first idle tick runs the suite on HEAD');
    const green = suiteState(t.s.cfg).lastGreen;
    const docs = t.land('notes', '*** write notes.md\nhello\n');
    assert.equal(docs.result.status, 'landed');
    assert.equal(docs.summary.suite, null, 'one landing is below suite_every');
    const cam = t.land('camera', CAMERA);
    assert.equal(cam.result.status, 'landed');
    assert.deepEqual(cam.result.selection.dropped, [SUITE], 'the suite left the landing gate');
    assert.equal(cam.summary.suite.status, 'failed');
    assert.equal(t.bugs.length, 1);
    const { type, text } = t.bugs[0];
    assert.equal(type, 'regression');
    const camSha = cam.result.landed.sha.slice(0, 7);
    assert.match(text, new RegExp(`failing alpha_case \\(--test alpha\\); range ${green.slice(0, 7)}\\.\\.${camSha} \\(2 landing\\(s\\)\\); likely causing_commit ${camSha} "camera \\(implements T-1\\)" \\(provenance: inferred, its paths map to --test alpha\\)`));
    assert.doesNotMatch(text, /other suspects/, 'the docs landing is not a suspect');
  } finally { t.s.done(); }
});

test('negative: no second filing for the same failures, no run while a job is queued or a build path is hand-edited, none with land_gate full', () => {
  const t = setup({ suite_every: 1 });
  try {
    processOnce(t.s.cfg, { fileBug: t.fileBug });
    t.land('camera', CAMERA);
    assert.equal(t.bugs.length, 1);
    t.land('notes', '*** write notes.md\nhello\n');
    assert.equal(suiteState(t.s.cfg).lastRun, g(['rev-parse', 'HEAD'], t.s.root), 'the suite re-ran on the new HEAD');
    assert.equal(t.bugs.length, 1, 'the same failing set is filed once');

    g(['commit', '--allow-empty', '-m', 'hand commit'], t.s.root);
    const { job } = buildPatchJob(t.s.cfg, { ticket: 'T-2' }, '*** write other.md\nx\n');
    writeJob(t.s.cfg, { ...job, commands: [OK] });
    assert.equal(runSuite(t.s.cfg, { fileBug: t.fileBug }), null, 'a queued job comes first');
    processOnce(t.s.cfg, { fileBug: t.fileBug });
    writeFileSync(join(t.s.root, 'crates/app/src/camera.rs'), 'hand edit\n');
    g(['commit', '--allow-empty', '-m', 'another'], t.s.root);
    assert.equal(runSuite(t.s.cfg, { fileBug: t.fileBug }), null, 'a hand-edited build path skips the run');
    assert.equal(runSuite({ ...t.s.cfg, landGate: 'full' }), null);
  } finally { t.s.done(); }
});
