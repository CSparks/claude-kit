// pre-write refuses the first file of a folder a Cargo workspace takes as a member without a Cargo.toml (KIT-T1275): a glob member
// folder with no manifest stops every cargo command in the workspace. Run: node hooks/crate-folder-gate.test.mjs

import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanup, git, hook, identify, reporter, repo } from './test-harness.mjs';
import { crateFolderViolation } from './lib/crate-folder-gate.mjs';

const { ok, done } = reporter('crate-folder-gate');

try {
  const dir = identify(repo());
  const put = (rel, text = '') => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
  const MANIFEST = (name) => `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n`;
  put('Cargo.toml', '[workspace]\nresolver = "2"\nmembers = [\n  "world/*", # glob\n  "tools/fixed",\n  "engine/**",\n]\nexclude = ["world/skipped"]\n');
  put('world/existing/Cargo.toml', MANIFEST('existing'));
  put('world/existing/src/lib.rs', 'pub fn f() {}\n');
  put('rust-notes.txt', 'x\n');
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'seed'], dir);

  // The path as git spells it (no 8.3 short names), the form a Write payload carries.
  const real = realpathSync.native(dir);
  const write = (rel, content = 'pub fn f() -> u32 { 1 }\n') => hook('pre-write.mjs', { session_id: 'S1', tool_name: 'Write', tool_input: { file_path: join(real, rel), content } }, dir);
  const blocked = (r, folder) => r.code === 2 && r.out.includes('Cargo.toml first') && (!folder || r.out.includes(folder));

  const first = write('world/fresh/src/geom.rs');
  ok('the first file of a glob member folder, under src/, is refused and the way out is named', blocked(first, 'world/fresh') && /src\/lib\.rs or src\/main\.rs in the same message/.test(first.out), first.out.trim());
  ok('a source file directly in the member folder is refused too', blocked(write('world/fresh/lib.rs'), 'world/fresh'));
  ok('a README as the first file of the folder is refused', blocked(write('world/fresh/README.md', '# x\n'), 'world/fresh'));
  ok('a folder a literal member names is refused the same way', blocked(write('tools/fixed/src/main.rs', 'fn main() {}\n'), 'tools/fixed'));
  ok('a folder a ** member takes is refused', blocked(write('engine/deep/nested/src/lib.rs'), 'engine/deep/nested') || blocked(write('engine/deep/src/lib.rs')));

  ok('the crate\'s Cargo.toml is allowed as the first file', write('world/fresh/Cargo.toml', MANIFEST('fresh')).code === 0);
  put('world/fresh/Cargo.toml', MANIFEST('fresh'));
  ok('once the manifest exists the crate\'s own files pass', write('world/fresh/src/lib.rs').code === 0 && write('world/fresh/src/geom.rs').code === 0);
  ok('a file in a crate that already has its manifest passes', write('world/existing/src/more.rs').code === 0);
  ok('an Edit-style rewrite of an existing file is not judged', write('world/existing/src/lib.rs').code === 0);

  ok('a folder the workspace excludes passes', write('world/skipped/src/lib.rs').code === 0);
  ok('a folder no member pattern matches passes', write('docs/notes.md', '# n\n').code === 0 && write('world/loose.rs').code === 0);
  ok('a file at the workspace root passes', write('build-notes.md', '# n\n').code === 0);

  put('.claude-kit-ignore.yaml', 'crate-folder:\n  - "world/optout/**"\n');
  const lifted = write('world/optout/src/lib.rs');
  ok('the crate-folder ignore key lifts it for a path', lifted.code === 0);
  ok('control: the ignore key lifts only the globbed path', blocked(write('world/fresh2/src/lib.rs'), 'world/fresh2'));

  ok('a path outside any Cargo workspace passes', crateFolderViolation(join(dir, '..', 'no-workspace', 'x', 'src', 'lib.rs')) === null);
  put('odd/Cargo.toml', '[workspace]\nmembers = ["crates/[ab]"]\n');
  ok('a member pattern with a character class is not read: fail open', crateFolderViolation(join(dir, 'odd', 'crates', 'a', 'src', 'lib.rs')) === null);
  put('broken/Cargo.toml', '[workspace\nmembers = ');
  ok('a manifest that cannot be read judges nothing: fail open', crateFolderViolation(join(dir, 'broken', 'x', 'lib.rs')) === null);
  put('single/Cargo.toml', MANIFEST('single'));
  ok('a package that is no workspace judges nothing', crateFolderViolation(join(dir, 'single', 'newdir', 'x.rs')) === null);
  put('nomembers/Cargo.toml', '[workspace]\nresolver = "2"\n');
  ok('a workspace without members judges nothing', crateFolderViolation(join(dir, 'nomembers', 'world', 'a', 'x.rs')) === null);
} finally {
  cleanup();
  done();
}
