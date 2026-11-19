// lint hook: skip rules (lockfiles, vendored paths) are silent, a missing toolchain
// warns without ever blocking, and Rust is linted per file with no cargo build.
// Gap logs go to a throwaway HOME.
// Run: node hooks/lint.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DEFAULT_EDITION, rustEdition, rustLintCommand } from './lib/rust-lint.mjs';
import { adopted, cleanup, homeEnv, hook, quietHome, reporter } from './test-harness.mjs';

const { ok, done } = reporter('lint');

try {
  const env = homeEnv(quietHome());
  const lr = adopted(false);

  writeFileSync(join(lr, 'package-lock.json'), '{}');
  let r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'package-lock.json') } }, lr, env);
  ok('lint: lockfile skipped silently', r.code === 0 && r.out.trim() === '');

  mkdirSync(join(lr, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(lr, 'node_modules', 'x', 'y.js'), 'var a = 1;\n');
  r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'node_modules', 'x', 'y.js') } }, lr, env);
  ok('lint: vendored path skipped silently', r.code === 0 && r.out.trim() === '');

  writeFileSync(join(lr, 'app.ts'), 'export const a = 1;\n');
  r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'app.ts') } }, lr, env);
  ok('lint: ts without package.json warns but never blocks', r.code === 0 && r.out.includes('No package.json'));

  const put = (rel, text) => {
    mkdirSync(dirname(join(lr, rel)), { recursive: true });
    writeFileSync(join(lr, rel), text);
  };
  put('ws/Cargo.toml', '[workspace]\nmembers = ["own", "inherit"]\n\n[workspace.package]\nedition = "2024"\n');
  put('ws/own/Cargo.toml', '[package]\nname = "own"\nversion = "0.1.0"\nedition = "2018"\n');
  put('ws/own/src/lib.rs', 'pub fn a() {}\n');
  put('ws/inherit/Cargo.toml', '[package]\nname = "inherit"\nversion = "0.1.0"\nedition.workspace = true\n\n[dependencies]\nedition = "9999"\n');
  put('ws/inherit/src/deep/m.rs', 'pub fn b() {}\n');
  put('ws/table/Cargo.toml', '[package]\nname = "table"\nedition = { workspace = true }\n');
  put('ws/table/src/lib.rs', '');
  put('bare/src/lib.rs', '');
  ok('rust-lint: a crate\'s literal edition wins', rustEdition(join(lr, 'ws/own/src/lib.rs')) === '2018');
  ok('rust-lint: edition.workspace = true resolves through [workspace.package], not another section', rustEdition(join(lr, 'ws/inherit/src/deep/m.rs')) === '2024');
  ok('rust-lint: edition = { workspace = true } resolves too', rustEdition(join(lr, 'ws/table/src/lib.rs')) === '2024');
  ok('rust-lint: no manifest falls back to the default edition', rustEdition(join(lr, 'bare/src/lib.rs')) === DEFAULT_EDITION);
  const file = join(lr, 'ws/own/src/lib.rs');
  const [cmd, args] = rustLintCommand(file);
  ok('rust-lint: one rustfmt --check on the edited file alone, never cargo (KIT-T1421)', cmd === 'rustfmt' && JSON.stringify(args) === JSON.stringify(['--check', '--edition', '2018', file]));
  r = hook('lint.mjs', { tool_input: { file_path: file } }, lr, env);
  ok('lint: a .rs edit exits 0 with no cargo output', r.code === 0 && !/Compiling|Checking|Blocking waiting/.test(r.out));
  const source = readFileSync(new URL('./lint.mjs', import.meta.url), 'utf8');
  ok('lint: the hook starts no cargo build on an edit (KIT-D162)', !/run\(\s*['"]cargo['"]/.test(source) && source.includes('rustLintCommand(file)'));
} finally {
  cleanup();
}

done();
