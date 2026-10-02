// pause.test.mjs — the coexistence rule (KIT-T276 L1): only modified tracked files and untracked
// files matching broker.untracked_blocks pause the queue; other untracked files (glb, png) do not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { composeCommand } from './run.mjs';
import { checkoutState } from './git.mjs';
import { globToRegExp } from './glob.mjs';
import { processOnce } from './queue.mjs';
import { writeJob, readResult } from './result.mjs';
import { tempDir, cleanup, makeRepo } from './testkit.mjs';
import { buildPatchJob } from './submit-lib.mjs';

const PASS = 'node -e "process.exit(0)"';
const put = (root, rel, text = 'x') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

function run(untracked) {
  const root = makeRepo(tempDir('pause-'));
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }], verify_default: [PASS] });
  put(root, untracked);
  const { job } = buildPatchJob(cfg, {}, '*** write p.txt\np\n');
  writeJob(cfg, { ...job, commands: [PASS] });
  const sum = processOnce(cfg);
  return { sum, result: readResult(cfg, job.id), done: () => cleanup(root) };
}

test('an untracked glb does not pause: the job runs', () => {
  const r = run('assets/x.glb');
  try { assert.equal(r.sum.paused, false); assert.equal(r.result.status, 'passed'); } finally { r.done(); }
});

test('an untracked crates/a/tests/x.rs pauses (cargo auto-discovers it)', () => {
  const r = run('crates/a/tests/x.rs');
  try { assert.equal(r.sum.paused, true); assert.equal(r.result.status, 'dirty'); } finally { r.done(); }
});

test('a modified tracked file pauses; --untracked-files=no keeps the state cheap', () => {
  const root = makeRepo(tempDir('pause-t-'));
  try {
    assert.equal(checkoutState(root).clean, true);
    put(root, 'README', 'changed\n');
    const st = checkoutState(root);
    assert.equal(st.clean, false);
    assert.ok(st.entries[0].includes('README'));
  } finally { cleanup(root); }
});

test('untracked_blocks is configurable and defaults to Rust sources', () => {
  assert.deepEqual(normalizeBroker('/r', {}).untrackedBlocks, ['**/*.rs', '**/Cargo.toml']);
  assert.deepEqual(normalizeBroker('/r', { untracked_blocks: ['**/*.py'] }).untrackedBlocks, ['**/*.py']);
  const root = makeRepo(tempDir('pause-g-'));
  try {
    put(root, 'Cargo.toml'); put(root, 'a/b/Cargo.toml'); put(root, 'a/b/c.png');
    const blocked = checkoutState(root, { untrackedBlocks: ['**/*.rs', '**/Cargo.toml'] }).entries;
    assert.deepEqual(blocked.sort(), ['?? Cargo.toml', '?? a/b/Cargo.toml']);
  } finally { cleanup(root); }
  assert.ok(globToRegExp('**/*.rs').test('x.rs') && globToRegExp('**/*.rs').test('a/b/x.rs') && !globToRegExp('**/*.rs').test('x.rsx'));
});

test('cargo t/b/r aliases compose like test/build/run', () => {
  assert.equal(composeCommand('cargo t -p x', { jobs: 3 }), 'cargo t -p x --no-fail-fast -j 3');
  assert.equal(composeCommand('cargo b', { jobs: 3 }), 'cargo b -j 3');
  assert.equal(composeCommand('cargo r --release', { jobs: 3 }), 'cargo r --release -j 3');
  assert.equal(composeCommand('cargo t --no-fail-fast -j 2', { jobs: 3 }), 'cargo t --no-fail-fast -j 2');
});
