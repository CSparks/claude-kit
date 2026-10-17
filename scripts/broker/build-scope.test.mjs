// build-scope.test.mjs — the broker owns only files whose change can fail a compilation (KIT-D097).
// A dirty doc, .ai/ file or build-irrelevant script never pauses the queue; neither does a file only
// embedded as data (include_str!); a dirty include!() target (Rust code) and cargo configuration do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { includeTargets } from './build-inputs.mjs';
import { isBuildInput } from './build-globs.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { cleanup, g, makeRepo, tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

const TRACKED = {
  'crates/a/src/lib.rs': 'const SCRIPT: &str = include_str!("../assets/x.rhai");\ninclude!("gen.inc");\n',
  'crates/a/src/gen.inc': 'fn generated() {}\n',
  'crates/a/assets/x.rhai': 'base\n',
  'docs/guide.md': 'base\n',
  '.ai/notes.md': 'base\n',
  'tools/helper.mjs': 'base\n',
  'Cargo.lock': 'base\n',
  '.cargo/config.toml': 'base\n',
};

// A tree with TRACKED committed, `dirty` edited, and one queued job run through the daemon's pass.
function run(dirty) {
  const root = makeRepo(tempDir('scope-'));
  for (const [f, text] of Object.entries(TRACKED)) put(root, f, text);
  g(['add', '-A'], root);
  g(['commit', '-m', 'tracked'], root);
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }], verify_default: [PASS] });
  put(root, dirty, 'edited while the daemon runs\n');
  const { job } = buildPatchJob(cfg, {}, '*** write p.txt\np\n');
  writeJob(cfg, { ...job, commands: [PASS] });
  const sum = processOnce(cfg);
  return { sum, status: readResult(cfg, job.id).status, root, done: () => cleanup(root) };
}

for (const path of ['docs/guide.md', '.ai/notes.md', 'tools/helper.mjs']) {
  test(`a dirty ${path} neither pauses the queue nor blocks the job`, () => {
    const r = run(path);
    try { assert.deepEqual([r.sum.paused, r.status], [false, 'passed']); } finally { r.done(); }
  });
}

test('a dirty include_str! target (a data file) does not pause the queue', () => {
  const r = run('crates/a/assets/x.rhai');
  try { assert.deepEqual([r.sum.paused, r.status], [false, 'passed']); } finally { r.done(); }
});

test('a dirty Cargo.lock does not pause (the broker journals it)', () => {
  const r = run('Cargo.lock');
  try { assert.deepEqual([r.sum.paused, r.status], [false, 'passed']); } finally { r.done(); }
});

for (const path of ['crates/a/src/gen.inc', '.cargo/config.toml', 'crates/a/src/lib.rs']) {
  test(`a dirty ${path} (Rust code or cargo configuration) pauses the queue`, () => {
    const r = run(path);
    try { assert.deepEqual([r.sum.paused, r.status], [true, 'dirty']); } finally { r.done(); }
  });
}

test('includeTargets resolves include!() relative to the including file and ignores include_str!', () => {
  const root = makeRepo(tempDir('scope-i-'));
  try {
    for (const [f, text] of Object.entries(TRACKED)) put(root, f, text);
    g(['add', '-A'], root);
    assert.deepEqual(includeTargets(root), ['crates/a/src/gen.inc']);
  } finally { cleanup(root); }
});

test('isBuildInput names code and cargo configuration, not docs, .ai or data', () => {
  for (const p of ['a/b.rs', 'build.rs', 'Cargo.toml', 'x/Cargo.lock', '.cargo/config.toml', 'rust-toolchain.toml']) assert.equal(isBuildInput(p), true, p);
  for (const p of ['docs/a.md', '.ai/x.md', 'assets/x.rhai', 'tools/h.mjs']) assert.equal(isBuildInput(p), false, p);
});
