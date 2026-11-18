// cargo-targets.mjs — which targets a cargo invocation selects, and whether a file under a package's tests/ directory can be
// read by them (KIT-T1384). `cargo test -p x --test road_ends_served` compiles the lib and that one test target, so a writer
// adding tests/yard_ground.rs next to it touches nothing that build reads.
//
//   targetSelection(args)         -> null when the call builds every target of its kind (no selection, or --tests,
//                                    --all-targets, --benches, ...), else { lib, tests: [names], bins, examples, benches }
//   testFileUnread(path, targets) -> true only when `path` sits under a package's tests/ directory and no selected test
//                                    target can read it; any doubt (a [[test]] table, #[path], include!, a `mod` naming it,
//                                    no Cargo.toml found) is false and the write stays held

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const VALUE = { '--test': 'tests', '--bin': 'bins', '--example': 'examples', '--bench': 'benches' };
const WIDE = new Set(['--tests', '--bins', '--examples', '--benches', '--all-targets', '--doc']);
const DOUBT = /#\s*\[\s*path\b|\binclude!\s*\(/;

export function targetSelection(args) {
  const sel = { lib: false, tests: [], bins: [], examples: [], benches: [] };
  let selected = false;
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '--') break;
    if (WIDE.has(a)) return null;
    if (a === '--lib') { sel.lib = true; selected = true; continue; }
    const [flag, inline] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    if (!VALUE[flag]) continue;
    const value = inline ?? args[++i];
    if (!value) return null;
    sel[VALUE[flag]].push(String(value));
    selected = true;
  }
  return selected ? sel : null;
}

function packageDir(path) {
  for (let dir = dirname(path); dirname(dir) !== dir; dir = dirname(dir)) {
    if (existsSync(join(dir, 'Cargo.toml'))) return dir;
  }
  return null;
}

const read = (file) => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };

// The root file of the test target `name`: tests/<name>.rs or tests/<name>/main.rs.
const testRoot = (pkg, name) => [join(pkg, 'tests', `${name}.rs`), join(pkg, 'tests', name, 'main.rs')].find(existsSync) || '';

export function testFileUnread(path, targets) {
  if (!targets) return false;
  const pkg = packageDir(path);
  if (!pkg || /^\s*\[\[test\]\]/m.test(read(join(pkg, 'Cargo.toml')))) return false;
  const parts = relative(pkg, path).replace(/\\/g, '/').split('/');
  if (parts[0] !== 'tests' || parts.length < 2) return false;
  const name = parts.length === 2 ? parts[1].replace(/\.rs$/, '') : parts[1];
  if (targets.tests.includes(name)) return false;
  const roots = targets.tests.map((t) => testRoot(pkg, t));
  if (roots.some((r) => !r)) return false;
  const mentions = new RegExp(String.raw`\bmod\s+${name.replace(/[^\w]/g, '')}\b`);
  return !roots.map(read).some((text) => DOUBT.test(text) || mentions.test(text));
}
