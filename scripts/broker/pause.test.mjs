// pause.test.mjs — the coexistence rule (KIT-T276 L1): only modified tracked files and untracked
// files matching broker.untracked_blocks pause the queue; other untracked files (glb, png) do not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { composeCommand } from './run.mjs';
import { checkoutState } from './git.mjs';
import { globToRegExp } from './glob.mjs';
import { processOnce } from './queue.mjs';
import { writeJob, readResult } from './result.mjs';
import { tempDir, cleanup, makeRepo, g } from './testkit.mjs';
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

// A repo with tracked asset/source/lock files, one of them dirtied, and a job writing p.txt.
function runDirty(dirty, envelope = '*** write p.txt\np\n') {
  const root = makeRepo(tempDir('pause-d-'));
  for (const f of ['assets/x.rhai', 'crates/a/src/lib.rs', 'Cargo.lock']) put(root, f, 'base\n');
  g(['add', '-A'], root); g(['commit', '-m', 'tracked'], root);
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }], verify_default: [PASS] });
  put(root, dirty, 'hot edit\n');
  const { job } = buildPatchJob(cfg, {}, envelope);
  writeJob(cfg, { ...job, commands: [PASS] });
  const sum = processOnce(cfg);
  return { root, sum, result: readResult(cfg, job.id), done: () => cleanup(root) };
}

test('a dirty tracked file the patch does not touch and no dirty_blocks glob matches does not pause', () => {
  const r = runDirty('assets/x.rhai');
  try {
    assert.equal(r.sum.paused, false);
    assert.equal(r.result.status, 'passed');
    assert.equal(readFileSync(join(r.root, 'assets/x.rhai'), 'utf8'), 'hot edit\n');
  } finally { r.done(); }
});

test('a dirty tracked file the patch touches pauses', () => {
  const r = runDirty('assets/x.rhai', '*** edit assets/x.rhai\n<<<<<<< SEARCH\nbase\n=======\nnew\n>>>>>>> REPLACE\n');
  try { assert.equal(r.sum.paused, true); assert.equal(r.result.status, 'dirty'); } finally { r.done(); }
});

test('a dirty tracked file matching dirty_blocks pauses', () => {
  const r = runDirty('crates/a/src/lib.rs');
  try { assert.equal(r.sum.paused, true); assert.equal(r.result.status, 'dirty'); } finally { r.done(); }
  assert.deepEqual(normalizeBroker('/r', {}).dirtyBlocks, ['**/*.rs', '**/Cargo.toml', '**/Cargo.lock']);
  assert.deepEqual(normalizeBroker('/r', { dirty_blocks: ['**/*.py'] }).dirtyBlocks, ['**/*.py']);
});

test('a check-only run whose command rewrites Cargo.lock leaves it byte-identical', () => {
  const rewrite = `node -e "const f=require('fs');f.writeFileSync('Cargo.lock','resolved');f.writeFileSync('sub/Cargo.lock','new')"`;
  const root = makeRepo(tempDir('pause-l-'));
  put(root, 'Cargo.lock', 'base\n'); put(root, 'sub/placeholder', 'x');
  g(['add', '-A'], root); g(['commit', '-m', 'lock'], root);
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }], verify_default: [PASS] });
  try {
    const { job } = buildPatchJob(cfg, {}, '*** write p.txt\np\n');
    writeJob(cfg, { ...job, commands: [rewrite] });
    processOnce(cfg);
    const rr = readResult(cfg, job.id); assert.equal(rr.status, 'passed', JSON.stringify(rr.commands));
    assert.equal(readFileSync(join(root, 'Cargo.lock'), 'utf8'), 'base\n');
    assert.equal(g(['status', '--porcelain', '-uall'], root), '');
  } finally { cleanup(root); }
});
