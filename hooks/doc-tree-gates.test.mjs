// Tests for the doc-tree hook gates (KIT-T284): pre-write blocks a new crate/concern folder with
// no header doc, commit-gate blocks structural source changes that leave the doc tree behind,
// orient prints the trunk map. Throwaway git repos, real hook runs. Run: node hooks/doc-tree-gates.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter } from './test-harness.mjs';
import { buildIndex, INDEX_REL } from '../scripts/doc-tree.mjs';

const { ok, done } = reporter('doc-tree-gates');
const CITE = 'git commit -m "implements KIT-T284"';

function put(root, rel, text = '') {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

// Adopted repo with one documented crate and a fresh index.
function treeRepo({ withIndex = true } = {}) {
  const d = identify(adopted(false));
  put(d, 'package.json', '{}');
  put(d, 'README.md', '# Trunk\n\nThe trunk map.\n');
  put(d, 'crates/alpha/Cargo.toml', '');
  put(d, 'crates/alpha/README.md', '# alpha\n\nAlpha crate.\n');
  put(d, 'crates/alpha/src/lib.rs', 'pub fn a() {}\n');
  if (withIndex) put(d, INDEX_REL, buildIndex(d));
  git(['add', '-A'], d);
  git(['commit', '-q', '-m', 'base [no-log: fixture]'], d);
  return d;
}
const write = (cwd, rel, content = 'x\n') => hook('pre-write.mjs', { tool_input: { file_path: join(cwd, rel), content } }, cwd);
const commit = (cwd) => hook('commit-gate.mjs', { tool_input: { command: CITE } }, cwd);

try {
  // --- (a) pre-write -------------------------------------------------------------
  {
    const d = treeRepo();
    ok('pre-write: new crate manifest with no README blocks', write(d, 'crates/beta/Cargo.toml', '[package]\n').code === 2);
    ok('pre-write: new concern folder source with no README blocks',
      write(d, 'crates/alpha/src/audio/mod.rs', 'pub fn b() {}\n').code === 2);
    put(d, 'crates/beta/README.md', '# beta\n\nBeta crate.\n');
    ok('pre-write: the same crate passes once its header doc exists', write(d, 'crates/beta/Cargo.toml', '[package]\n').code === 0);
    ok('pre-write: writing the header doc itself passes', write(d, 'crates/gamma/README.md', '# gamma\n\nGamma.\n').code === 0);
    ok('pre-write: a new file in an existing documented unit passes', write(d, 'crates/alpha/src/more.rs', 'pub fn c() {}\n').code === 0);
    put(d, 'crates/alpha/src/audio/old.rs', 'pub fn o() {}\n');
    ok('pre-write: new file in an existing folder lacking a header is a gap, not a new folder',
      write(d, 'crates/alpha/src/audio/new.rs', 'pub fn n() {}\n').code === 0);
    const blocked = write(d, 'crates/delta/Cargo.toml', '[package]\n');
    ok('pre-write: block names the check-id for exclusion', /doc-tree/.test(blocked.out));
    put(d, '.claude-kit-ignore.yaml', 'doc-tree:\n  - "crates/delta/**"\n');
    ok('pre-write: path exclusion lets it through', write(d, 'crates/delta/Cargo.toml', '[package]\n').code === 0);

    const plain = adopted(false);
    ok('pre-write: a repo without docs/TREE.md is untouched', write(plain, 'crates/beta/Cargo.toml', '[package]\n').code === 0);
  }

  // --- (b) commit-gate -----------------------------------------------------------
  {
    const d = treeRepo();
    put(d, 'crates/alpha/src/extra.rs', 'pub fn e() {}\n');
    git(['add', '-A'], d);
    const bare = commit(d);
    ok('commit: added source with no doc-tree change blocks', bare.code === 2 && /extra\.rs/.test(bare.out) && /doc-tree/.test(bare.out));

    put(d, 'crates/alpha/README.md', '# alpha\n\nAlpha crate, now with extras.\n');
    git(['add', '-A'], d);
    const stale = commit(d);
    ok('commit: header changed but index stale blocks', stale.code === 2 && /stale/.test(stale.out));

    put(d, INDEX_REL, buildIndex(d));
    git(['add', '-A'], d);
    ok('commit: header + regenerated index passes', commit(d).code === 0);
  }
  {
    const d = treeRepo();
    put(d, 'crates/alpha/src/lib.rs', 'pub fn a() { let _ = 1; }\n');
    git(['add', '-A'], d);
    ok('commit: modifying existing source needs no doc change', commit(d).code === 0);
  }
  {
    const d = treeRepo();
    git(['mv', 'crates/alpha/src/lib.rs', 'crates/alpha/src/core.rs'], d);
    ok('commit: renaming source without doc update blocks', commit(d).code === 2);
  }
  {
    const d = treeRepo();
    git(['rm', '-q', 'crates/alpha/src/lib.rs'], d);
    ok('commit: deleting source without doc update blocks', commit(d).code === 2);
  }
  {
    const d = treeRepo();
    put(d, 'crates/alpha/src/extra.rs', 'pub fn e() {}\n');
    put(d, '.claude-kit-ignore.yaml', 'doc-tree:\n  - "crates/alpha/src/extra.rs"\n');
    git(['add', '-A'], d);
    ok('commit: path exclusion lets structural change through', commit(d).code === 0);
  }
  {
    const d = treeRepo({ withIndex: false });
    put(d, 'crates/alpha/src/extra.rs', 'pub fn e() {}\n');
    git(['add', '-A'], d);
    ok('commit: repo without docs/TREE.md is untouched', commit(d).code === 0);
  }

  // --- (c) orient ----------------------------------------------------------------
  {
    const d = treeRepo();
    const r = hook('orient.mjs', { hook_event_name: 'SessionStart' }, d);
    ok('orient: prints the trunk map when the doc tree is adopted',
      /--- DOC TREE/.test(r.out) && r.out.includes('crates/alpha — Alpha crate.'));
    const plain = hook('orient.mjs', { hook_event_name: 'SessionStart' }, treeRepo({ withIndex: false }));
    ok('orient: no DOC TREE section without docs/TREE.md', !/--- DOC TREE/.test(plain.out));
  }
} finally {
  cleanup();
}
done();
