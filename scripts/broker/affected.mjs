// affected.mjs — map a patch's changed paths to the cargo test targets that exercise them
// (KIT-T472), so a landing runs the tests it touches and the full suite runs on its own cadence.
//
// Rules, per changed path (relative to the job's checkout):
//   <crate>/tests/<t>.rs, <crate>/tests/<t>/main.rs   → --test <t>
//   <crate>/tests/<dir>/… (a shared module)            → every test target whose source names <dir>
//   <crate>/src/bin/<b>.rs                             → --bin <b>
//   <crate>/src/…/<m>.rs (mod.rs: its directory)       → --lib, plus every test target whose source names <m>
//   <crate>/src/lib.rs|main.rs, Cargo.toml, build.rs   → --lib (crate-wide; the check and the suite cover the rest)
//   any other file in a crate (assets, goldens)        → every test target whose source names its file name
//   *.md / *.txt                                       → nothing
//   a .rs or Cargo.toml outside every crate            → unmapped (the caller falls back to the full gate)
//
// A deleted target root (a test, a bin, src/lib.rs) picks nothing: its target no longer exists.
//
// `selectAffected(cwd, paths, { deleted, match })` → { crates: Map<crate, Set<spec>>, workspaces: Map<crate, dir>,
//   reasons: [{ path, crate, picks }], unmapped: [path] }.
//   workspaces: the directory (posix, '' = cwd) of the workspace owning each crate — the nearest enclosing
//   `[workspace]` manifest — so a submodule's crate is tested in the submodule's own workspace (`rust/`).
//   match: 'word' (default) | 'module': how a src module is matched to the test sources (affected-match.mjs).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { namingMatcher } from './affected-match.mjs';

const DOCS = /\.(?:md|txt)$/i;
const CRATE_WIDE = new Set(['src/lib.rs', 'src/main.rs', 'Cargo.toml', 'build.rs']);
const RUST_BUILD = /(?:\.rs|(?:^|\/)Cargo\.toml)$/;

const posix = (p) => String(p).replace(/\\/g, '/');

function packageName(manifest) {
  const text = readFileSync(manifest, 'utf8');
  const pkg = text.split(/^\[/m).find((s) => s.startsWith('package]'));
  const m = pkg && pkg.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

// The nearest enclosing package: { dir (posix, '' = cwd), name } or null.
function crateOf(cwd, path, memo) {
  for (let d = dirname(path); ; d = dirname(d)) {
    const dir = d === '.' ? '' : d;
    if (!memo.has(dir)) {
      const manifest = join(cwd, dir, 'Cargo.toml');
      memo.set(dir, existsSync(manifest) ? packageName(manifest) : null);
    }
    if (memo.get(dir)) return { dir, name: memo.get(dir) };
    if (d === '.' || d === dirname(d)) return null;
  }
}

// The directory of the workspace owning the crate at `crateDir`: the nearest enclosing manifest with a `[workspace]` table ('' when none).
function workspaceOf(cwd, crateDir, memo) {
  for (let d = crateDir; ; d = dirname(d) === '.' ? '' : dirname(d)) {
    if (!memo.has(d)) {
      const manifest = join(cwd, d, 'Cargo.toml');
      memo.set(d, existsSync(manifest) && /^\[workspace\]/m.test(readFileSync(manifest, 'utf8')));
    }
    if (memo.get(d)) return d;
    if (d === '') return '';
  }
}

// Integration test targets of a crate: [{ name, text }].
function testTargets(cwd, crateDir) {
  const root = join(cwd, crateDir, 'tests');
  if (!existsSync(root)) return [];
  const out = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.rs')) out.push({ name: e.name.slice(0, -3), text: readFileSync(join(root, e.name), 'utf8') });
    else if (e.isDirectory() && existsSync(join(root, e.name, 'main.rs'))) out.push({ name: e.name, text: readFileSync(join(root, e.name, 'main.rs'), 'utf8') });
  }
  return out;
}

const WORD_MATCH = namingMatcher('word', {});
const naming = (targets, word, matches = WORD_MATCH) => targets.filter((t) => matches(t.text, word)).map((t) => `--test ${t.name}`);

// Specs for one path inside a crate; `rel` is crate-relative. `live(rel)` says whether a file is
// in the patched tree: a deleted target root picks nothing, and `--lib` needs a live src/lib.rs.
function picksFor(rel, targets, live, crate, mode) {
  const lib = live('src/lib.rs') ? ['--lib'] : [];
  if (CRATE_WIDE.has(rel)) return lib;
  const test = rel.match(/^tests\/([^/]+)\.rs$/) || rel.match(/^tests\/([^/]+)\/main\.rs$/);
  if (test) return live(rel) && targets.some((t) => t.name === test[1]) ? [`--test ${test[1]}`] : [];
  const shared = rel.match(/^tests\/([^/]+)\//);
  if (shared) return live(`tests/${shared[1]}/main.rs`) ? [`--test ${shared[1]}`] : naming(targets, shared[1]);
  const bin = rel.match(/^src\/bin\/([^/]+?)(?:\.rs|\/main\.rs)$/);
  if (bin) return live(rel) ? [`--bin ${bin[1]}`] : [];
  if (rel.startsWith('src/') && rel.endsWith('.rs')) {
    const file = basename(rel, '.rs');
    const dirs = dirname(rel).split('/');
    if (file === 'mod') dirs.pop();
    const mod = file === 'mod' ? basename(dirname(rel)) : file;
    const parent = dirs[dirs.length - 1] === 'src' ? '' : dirs[dirs.length - 1];
    return [...lib, ...naming(targets, mod, namingMatcher(mode, { crate, parent }))];
  }
  return naming(targets, basename(rel));
}

export function selectAffected(cwd, paths, { deleted = [], match = 'word' } = {}) {
  const gone = new Set(deleted.map(posix));
  const memo = new Map();
  const wsMemo = new Map();
  const workspaces = new Map();
  const targetsOf = new Map();
  const crates = new Map();
  const reasons = [];
  const unmapped = [];
  for (const raw of paths) {
    const path = posix(raw);
    if (DOCS.test(path)) { reasons.push({ path, crate: null, picks: [] }); continue; }
    const crate = crateOf(cwd, path, memo);
    if (!crate) {
      if (RUST_BUILD.test(path) || extname(path) === '.lock') unmapped.push(path);
      else reasons.push({ path, crate: null, picks: [] });
      continue;
    }
    if (!targetsOf.has(crate.dir)) targetsOf.set(crate.dir, testTargets(cwd, crate.dir));
    const rel = crate.dir ? path.slice(crate.dir.length + 1) : path;
    const crateRoot = join(cwd, crate.dir);
    const live = (r) => !gone.has(crate.dir ? `${crate.dir}/${r}` : r) && existsSync(join(crateRoot, r));
    const picks = picksFor(rel, targetsOf.get(crate.dir), live, crate.name, match);
    workspaces.set(crate.name, workspaceOf(cwd, crate.dir, wsMemo));
    if (!crates.has(crate.name)) crates.set(crate.name, new Set());
    for (const p of picks) crates.get(crate.name).add(p);
    reasons.push({ path, crate: crate.name, picks });
  }
  return { crates, workspaces, reasons, unmapped };
}
