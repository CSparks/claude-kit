// hold-rekey.test.mjs — what a paused lane says stays true (KIT-T571): the hold marker follows the live
// job when the job it named is replaced, an untracked scratch file that matches the build glob is named as
// such, the phase file does not claim the lane is applying, and `resume` says an operator pause is not a
// dirty hold. Controls: removing the scratch file runs the job; a scratch file outside the glob never holds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { readHold } from './dirty.mjs';
import { holdLine, holdReport } from './hand-hold.mjs';
import { readPhase } from './phase.mjs';
import { processOnce } from './queue.mjs';
import { readResult, removeJob, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { cleanup, g, makeRepo, tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const SPIKE = 'crates/x/examples/spike.rs';
const put = (root, rel, text = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

function scratchTree() {
  const root = makeRepo(tempDir('rekey-'));
  put(root, 'Cargo.toml', '[workspace]\nmembers = ["crates/*"]\n');
  put(root, 'crates/x/Cargo.toml', '[package]\nname = "x"\n');
  put(root, 'crates/x/src/lib.rs');
  g(['add', '-A'], root);
  g(['commit', '-m', 'workspace'], root);
  mkdirSync(join(root, '.ai'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: ., main: main, remote: origin }\n  untracked_blocks: ["crates/**/*.rs"]\n');
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], untracked_blocks: ['crates/**/*.rs'] });
  const submit = (title) => {
    const { job } = buildPatchJob(cfg, { ticket: 'T-1', title }, '*** write notes.txt\nhello\n');
    return writeJob(cfg, { ...job, commands: ['node -e "0"'] });
  };
  return { root, cfg, submit, done: () => cleanup(root) };
}

test('the marker follows the live job when the one it named is replaced, keeping since; the new job gets the dirty result', () => {
  const t = scratchTree();
  try {
    put(t.root, SPIKE);
    const a = t.submit('A');
    assert.equal(processOnce(t.cfg).paused, true);
    const first = readHold(t.cfg);
    assert.equal(first.id, a.id);
    removeJob(t.cfg, a.id);
    const b = t.submit('B');
    assert.equal(processOnce(t.cfg).paused, true);
    const now = readHold(t.cfg);
    assert.equal(now.id, b.id, 'the marker names the live job');
    assert.equal(now.since, first.since, 'the hold keeps its start');
    assert.ok(now.entries.includes(`?? ${SPIKE}`), now.entries.join(','));
    assert.equal(readResult(t.cfg, b.id).status, 'dirty', 'the new job\'s worker hears why');
  } finally { t.done(); }
});

test('the hold line names untracked build inputs and the glob when every entry is untracked', () => {
  const t = scratchTree();
  try {
    put(t.root, SPIKE);
    t.submit('A');
    processOnce(t.cfg);
    const line = holdLine(holdReport(t.cfg));
    assert.match(line, /untracked build input matching crates\/\*\*\/\*\.rs: cargo auto-discovers these/);
    assert.match(readResult(t.cfg, readHold(t.cfg).id).message, /untracked build input matching crates\/\*\*\/\*\.rs/);
  } finally { t.done(); }
});

test('the phase file says held, not applying, while the lane is paused', () => {
  const t = scratchTree();
  try {
    put(t.root, SPIKE);
    const a = t.submit('A');
    processOnce(t.cfg);
    assert.deepEqual([readPhase(t.cfg).id, readPhase(t.cfg).phase], [a.id, 'held']);
  } finally { t.done(); }
});

test('resume says it cleared only the operator pause and names the dirty hold that remains', () => {
  const t = scratchTree();
  try {
    put(t.root, SPIKE);
    t.submit('A');
    processOnce(t.cfg);
    const r = spawnSync(process.execPath, [BROKER, 'resume', '--root', t.root], { encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.match(r.stderr, /operator pause cleared; dirty hold remains: .*crates\/x\/examples\/spike\.rs/);
  } finally { t.done(); }
});

test('controls: removing the scratch file runs the job and clears the hold; a scratch file outside the glob never holds; resume on a clean lane just resumes', () => {
  const t = scratchTree();
  try {
    put(t.root, SPIKE);
    const a = t.submit('A');
    processOnce(t.cfg);
    g(['clean', '-fdq', 'crates/x/examples'], t.root);
    assert.equal(processOnce(t.cfg).paused, false);
    assert.equal(readResult(t.cfg, a.id).status, 'passed');
    assert.equal(existsSync(join(t.cfg.targetDir, 'broker', 'dirty-hold.json')), false);
    put(t.root, 'scratch/a.rs');
    const b = t.submit('B');
    assert.equal(processOnce(t.cfg).paused, false);
    assert.equal(readResult(t.cfg, b.id).status, 'passed');
    const r = spawnSync(process.execPath, [BROKER, 'resume', '--root', t.root], { encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.match(r.stderr, /broker: resumed/);
    assert.doesNotMatch(r.stderr, /dirty hold remains/);
  } finally { t.done(); }
});
