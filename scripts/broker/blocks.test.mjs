// blocks.test.mjs — the untracked block set follows the checkout's cargo layout (KIT-T293): an
// untracked standalone crate outside the workspace (stiletto's tools/generator-reload) no
// longer pauses the queue, while new files cargo would build still do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { derivedUntrackedBlocks } from './blocks.mjs';
import { checkoutState } from './git.mjs';
import { processOnce } from './queue.mjs';
import { writeJob, readResult } from './result.mjs';
import { tempDir, cleanup, makeRepo, g } from './testkit.mjs';
import { buildPatchJob } from './submit-lib.mjs';

const PASS = 'node -e "process.exit(0)"';
const put = (root, rel, text = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

function workspaceRepo(prefix) {
  const root = makeRepo(tempDir(prefix));
  put(root, 'Cargo.toml', '# the root package\n[package]\nname = "app"\n\n[workspace]\nmembers = [\n  "crates/*", # concern crates\n]\n\n[dependencies]\n');
  put(root, 'src/main.rs'); put(root, 'crates/a/Cargo.toml', '[package]\nname = "a"\n'); put(root, 'crates/a/src/lib.rs');
  g(['add', '-A'], root); g(['commit', '-m', 'workspace'], root);
  return root;
}

test('the derived set covers tracked crates and workspace members, not a standalone crate', () => {
  const root = workspaceRepo('blocks-a-');
  try {
    const blocks = derivedUntrackedBlocks(root);
    assert.deepEqual([...blocks].sort(), ['Cargo.toml', 'benches/**/*.rs', 'build.rs', 'crates/*/**/*.rs', 'crates/*/Cargo.toml', 'crates/a/**/*.rs', 'crates/a/Cargo.toml', 'examples/**/*.rs', 'src/**/*.rs', 'tests/**/*.rs']);
    for (const p of ['tools/generator-reload/Cargo.toml', 'tools/generator-reload/src/lib.rs']) put(root, p);
    assert.deepEqual(checkoutState(root, { untrackedBlocks: blocks }).entries, [], 'the untracked standalone crate is free');
    assert.equal(checkoutState(root, { untrackedBlocks: ['**/*.rs', '**/Cargo.toml'] }).entries.length, 2, 'the old glob paused on it');
  } finally { cleanup(root); }
});

test('files cargo would build still block: a new test, a new member crate, a new root source', () => {
  const root = workspaceRepo('blocks-b-');
  try {
    for (const p of ['crates/a/tests/new.rs', 'crates/b/Cargo.toml', 'src/extra.rs', 'tools/generator-reload/Cargo.toml', 'assets/x.png']) put(root, p);
    const entries = checkoutState(root, { untrackedBlocks: derivedUntrackedBlocks(root) }).entries;
    assert.deepEqual(entries.sort(), ['?? crates/a/tests/new.rs', '?? crates/b/Cargo.toml', '?? src/extra.rs']);
  } finally { cleanup(root); }
});

test('a checkout with no tracked Cargo.toml keeps the default glob', () => {
  const root = makeRepo(tempDir('blocks-c-'));
  try {
    assert.equal(derivedUntrackedBlocks(root), null);
    assert.equal(normalizeBroker(root, {}).untrackedDerived, true);
    assert.equal(normalizeBroker(root, { untracked_blocks: ['x/**'] }).untrackedDerived, false);
  } finally { cleanup(root); }
});

test('the queue runs a job past an untracked standalone crate, and an explicit untracked_blocks still pauses on it', () => {
  const root = workspaceRepo('blocks-d-');
  try {
    put(root, 'tools/generator-reload/src/lib.rs');
    for (const [broker, status] of [[{}, 'passed'], [{ untracked_blocks: ['**/*.rs'] }, 'dirty']]) {
      const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }], verify_default: [PASS], ...broker });
      const { job } = buildPatchJob(cfg, {}, '*** write p.txt\np\n');
      writeJob(cfg, { ...job, commands: [PASS] });
      processOnce(cfg);
      assert.equal(readResult(cfg, job.id).status, status);
    }
  } finally { cleanup(root); }
});
