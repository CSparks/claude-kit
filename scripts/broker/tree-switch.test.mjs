// tree-switch.test.mjs — why a build that alternates between the live tree and the check tree rebuilds crates it never touched.
// Both trees share one target dir (the cache both depend on). A build script that prints `cargo:rerun-if-changed=<absolute path>`
// stamps the tree it ran in into the shared fingerprint, so the other tree's next build reruns it and recompiles the crate and
// everything above it (rg-code-stamp's `emit` and rg-lettering's build.rs did exactly this; a dirt-empire gate in the live tree
// and the next job in the check tree rebuilt 20+ crates each way). A relative path is resolved per tree and stays fresh.
// Real git and real cargo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, g, makeRepo, tempDir } from './testkit.mjs';

const HAS_CARGO = spawnSync('cargo', ['--version'], { shell: true }).status === 0;
const WRITE_STAMP = 'std::fs::write(std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("stamp.rs"), "pub const STAMP: u32 = 1;").unwrap();';
const ABSOLUTE = 'println!("cargo:rerun-if-changed={}", std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("src").display());';
const RELATIVE = 'println!("cargo:rerun-if-changed=src");';
const LIB = 'include!(concat!(env!("OUT_DIR"), "/stamp.rs"));\npub fn f() -> u32 { STAMP }\n';

function workspace(rerunDirective) {
  const root = makeRepo(tempDir('switch-'));
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nmembers = ["crates/stamped"]\nresolver = "2"\n');
  mkdirSync(join(root, 'crates', 'stamped', 'src'), { recursive: true });
  writeFileSync(join(root, 'crates', 'stamped', 'Cargo.toml'), '[package]\nname = "stamped"\nversion = "0.1.0"\nedition = "2021"\n');
  writeFileSync(join(root, 'crates', 'stamped', 'build.rs'), `fn main() { ${WRITE_STAMP} ${rerunDirective} }\n`);
  writeFileSync(join(root, 'crates', 'stamped', 'src', 'lib.rs'), LIB);
  writeFileSync(join(root, '.gitignore'), 'target\n');
  g(['add', '-A'], root);
  g(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'ws'], root);
  return root;
}

function rebuilt(cwd, targetDir) {
  const r = spawnSync('cargo', ['check', '--offline'], { cwd, encoding: 'utf8', env: { ...process.env, CARGO_TARGET_DIR: targetDir }, shell: true });
  assert.equal(r.status, 0, r.stderr);
  return /(Checking|Compiling) stamped/.test(r.stderr);
}

function alternate(rerunDirective) {
  const live = workspace(rerunDirective);
  const check = join(tempDir('switch-wt-'), 'check');
  g(['worktree', 'add', '-q', '--detach', check, 'HEAD'], live);
  const target = tempDir('switch-target-');
  try {
    rebuilt(live, target);
    return { checkAfterLive: rebuilt(check, target), liveAfterCheck: rebuilt(live, target), checkAgain: rebuilt(check, target) };
  } finally { cleanup(live); cleanup(target); }
}

test('a build script with an absolute rerun-if-changed recompiles in the other tree each time the trees alternate', { skip: !HAS_CARGO }, () => {
  const r = alternate(ABSOLUTE);
  assert.equal(r.checkAfterLive, true, 'the check tree rebuilds what the live tree built');
  assert.equal(r.liveAfterCheck, true, 'and the live tree rebuilds it back');
});

test('control: a relative rerun-if-changed leaves the shared cache fresh across trees', { skip: !HAS_CARGO }, () => {
  const r = alternate(RELATIVE);
  assert.deepEqual(r, { checkAfterLive: false, liveAfterCheck: false, checkAgain: false });
});
