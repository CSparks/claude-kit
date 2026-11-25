// workspace-crate-guard (KIT-T1533): a file written in a Cargo workspace member crate that has no build target prints an
// advisory naming the crate; a crate with its target, a folder outside a workspace or an excluded member prints nothing.
// Run: node hooks/workspace-crate-guard.test.mjs

import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanup, hook, identify, reporter, repo } from './test-harness.mjs';

const { ok, done } = reporter('workspace-crate-guard');

try {
  const dir = identify(repo());
  const real = realpathSync.native(dir);
  const put = (rel, text = '') => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
  const manifest = (name, extra = '') => `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n${extra}`;
  put('Cargo.toml', '[workspace]\nresolver = "2"\nmembers = ["core/*", "tools/fixed"]\nexclude = ["core/skipped"]\n');

  const after = (rel) => hook('workspace-crate-guard.mjs', { session_id: 'S1', tool_name: 'Write', tool_input: { file_path: join(real, rel), content: 'x' } }, dir);
  const context = (r) => (r.out ? JSON.parse(r.out).hookSpecificOutput.additionalContext : '');

  put('core/bare/Cargo.toml', manifest('bare'));
  const bare = after('core/bare/Cargo.toml');
  ok('a member crate with a manifest and no lib.rs is reported, exit 0', bare.code === 0 && /WORKSPACE CRATE GUARD/.test(context(bare)));
  ok('the advisory names the crate, the workspace and the failure', context(bare).includes('core') && context(bare).includes('bare') && /every cargo command in the workspace fails to load/i.test(context(bare)));

  put('core/bare/src/geom.rs', 'pub fn f() {}\n');
  ok('a source file written in the crate with no lib.rs or main.rs is reported', /WORKSPACE CRATE GUARD/.test(context(after('core/bare/src/geom.rs'))));

  put('core/withlib/Cargo.toml', manifest('withlib'));
  put('core/withlib/src/lib.rs', 'pub fn f() {}\n');
  ok('a crate with src/lib.rs is silent', after('core/withlib/src/lib.rs').out === '' && after('core/withlib/Cargo.toml').out === '');

  put('core/withmain/Cargo.toml', manifest('withmain'));
  put('core/withmain/src/main.rs', 'fn main() {}\n');
  ok('a crate with src/main.rs is silent', after('core/withmain/src/main.rs').out === '');

  put('core/withbin/Cargo.toml', manifest('withbin'));
  put('core/withbin/src/bin/tool.rs', 'fn main() {}\n');
  ok('a crate with a src/bin target is silent', after('core/withbin/Cargo.toml').out === '');

  put('core/declared/Cargo.toml', manifest('declared', '\n[lib]\npath = "engine/mod.rs"\n'));
  ok('a [lib] path that does not exist is reported', /WORKSPACE CRATE GUARD/.test(context(after('core/declared/Cargo.toml'))));
  put('core/declared/engine/mod.rs', 'pub fn f() {}\n');
  ok('a [lib] path that exists is silent', after('core/declared/Cargo.toml').out === '');

  put('tools/fixed/Cargo.toml', manifest('fixed'));
  ok('a literal member without a target is reported', /WORKSPACE CRATE GUARD/.test(context(after('tools/fixed/Cargo.toml'))));

  put('core/skipped/Cargo.toml', manifest('skipped'));
  ok('an excluded member is silent', after('core/skipped/Cargo.toml').out === '');

  put('other/Cargo.toml', manifest('other'));
  ok('a crate no member pattern matches is silent', after('other/Cargo.toml').out === '');

  put('core/nested/Cargo.toml', manifest('nested'));
  ok('a file below a crate is judged by the crate: the notes folder in a bare crate is reported', /WORKSPACE CRATE GUARD/.test(context(after('core/nested/docs/notes.md'))));

  ok('a file at the workspace root is silent', after('README.md').out === '');

  const lone = identify(repo());
  mkdirSync(join(lone, 'core', 'solo'), { recursive: true });
  writeFileSync(join(lone, 'core', 'solo', 'Cargo.toml'), manifest('solo'));
  const loneFile = join(realpathSync.native(lone), 'core', 'solo', 'Cargo.toml');
  const alone = hook('workspace-crate-guard.mjs', { session_id: 'S1', tool_name: 'Write', tool_input: { file_path: loneFile } }, lone);
  ok('a crate outside any workspace is silent', alone.code === 0 && alone.out === '');

  put('.claude-kit-ignore.yaml', 'crate-target:\n  - "tools/**"\n');
  ok('the crate-target ignore key lifts the advisory for a path', after('tools/fixed/Cargo.toml').out === '');
  ok('control: the ignore key lifts only the globbed path', /WORKSPACE CRATE GUARD/.test(context(after('core/bare/Cargo.toml'))));
} finally {
  cleanup();
  done();
}
