// affected.mjs — map a patch's changed paths to the cargo test targets that exercise them
// (KIT-T472), so a landing runs the tests it touches and the full suite runs on its own cadence.
//
// Rules, per changed path (relative to the job's checkout):
//   <crate>/tests/<t>.rs, <crate>/tests/<t>/main.rs   → --test <t>
//   <crate>/tests/<area>/<m>.rs, <area>/<m>/…           → --test <area> -- <m>:: (a folded binary: one module per old test file; also the
//                                                          modules of <area> whose source names <m>)
//   <crate>/tests/<dir>/… (a shared module)            → every test target whose source names <dir>
//   <crate>/src/bin/<b>.rs                             → --bin <b>
//   <crate>/src/…/<m>.rs (mod.rs: its directory)       → --lib, plus every test target whose source names <m>; in a folded
//                                                          binary only the modules naming <m> (`--test <area> -- <mod>::`), the whole
//                                                          binary when its main.rs names <m> outside its `mod x;` lines
//   <crate>/src/lib.rs|main.rs, Cargo.toml, build.rs   → --lib (crate-wide; the check and the suite cover the rest)
//   any other file in a crate (assets, goldens)        → every test target whose source names its file name
//   *.md / *.txt                                       → nothing
//   a .rs or Cargo.toml outside every crate            → unmapped (the caller falls back to the full gate)
//
// A folded binary's module filters are specs `--test <area> -- <mod>::`; `splitSpecs` groups them so the caller runs one
// filtered command per area (a filter applies to every binary of a command, so it never shares one with `--lib`).
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

// Source text of every .rs file under `dir` (recursive).
function treeText(dir) {
  let text = '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.rs')) text += `\n${readFileSync(join(dir, e.name), 'utf8')}`;
    else if (e.isDirectory()) text += treeText(join(dir, e.name));
  }
  return text;
}

// The modules of a folded test binary `tests/<area>/main.rs`: [{ name, text }], one per sibling .rs file or directory.
function areaModules(areaDir) {
  const out = [];
  for (const e of readdirSync(areaDir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.rs') && e.name !== 'main.rs') out.push({ name: e.name.slice(0, -3), text: readFileSync(join(areaDir, e.name), 'utf8') });
    else if (e.isDirectory()) out.push({ name: e.name, text: treeText(join(areaDir, e.name)) });
  }
  return out;
}

// main.rs without the `mod <sibling>;` lines every folded binary carries: they name each module, so they say nothing about a src change.
const withoutModLines = (text, siblings) => text.split('\n').filter((l) => {
  const m = l.match(/^\s*(?:pub\s+)?mod\s+(\w+)\s*;/);
  return !(m && siblings.has(m[1]));
}).join('\n');

// Integration test targets of a crate: [{ name, text, modules }]; modules is [] for a single-file target.
function testTargets(cwd, crateDir) {
  const root = join(cwd, crateDir, 'tests');
  if (!existsSync(root)) return [];
  const out = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.rs')) out.push({ name: e.name.slice(0, -3), text: readFileSync(join(root, e.name), 'utf8'), modules: [] });
    else if (e.isDirectory() && existsSync(join(root, e.name, 'main.rs'))) {
      const modules = areaModules(join(root, e.name));
      out.push({ name: e.name, text: withoutModLines(readFileSync(join(root, e.name, 'main.rs'), 'utf8'), new Set(modules.map((m) => m.name))), modules });
    }
  }
  return out;
}

const WORD_MATCH = namingMatcher('word', {});
const AREA_FILTER = /^--test (\S+) -- (\S+)$/;

// Specs for the test targets whose source names `word`. A folded binary whose own main.rs does not name it gets one
// `--test <area> -- <module>::` filter per module that does.
function naming(targets, word, matches = WORD_MATCH) {
  const out = [];
  for (const t of targets) {
    if (matches(t.text, word)) out.push(`--test ${t.name}`);
    else for (const m of t.modules) if (matches(m.text, word)) out.push(`--test ${t.name} -- ${m.name}::`);
  }
  return out;
}

/** A crate's specs as { plain: [spec], areas: Map<area, [filter]> }; an area already run whole in `plain` keeps no filters. */
export function splitSpecs(specs) {
  const plain = [];
  const areas = new Map();
  for (const spec of specs) {
    const m = AREA_FILTER.exec(spec);
    if (m) areas.set(m[1], [...(areas.get(m[1]) || []), m[2]]);
    else plain.push(spec);
  }
  for (const area of [...areas.keys()]) if (plain.includes(`--test ${area}`)) areas.delete(area);
  return { plain, areas };
}

// Specs for one path inside a crate; `rel` is crate-relative. `live(rel)` says whether a file is
// in the patched tree: a deleted target root picks nothing, and `--lib` needs a live src/lib.rs.
function picksFor(rel, targets, live, crate, mode) {
  const lib = live('src/lib.rs') ? ['--lib'] : [];
  if (CRATE_WIDE.has(rel)) return lib;
  const test = rel.match(/^tests\/([^/]+)\.rs$/) || rel.match(/^tests\/([^/]+)\/main\.rs$/);
  if (test) return live(rel) && targets.some((t) => t.name === test[1]) ? [`--test ${test[1]}`] : [];
  const shared = rel.match(/^tests\/([^/]+)\/([^/]+?)(?:\.rs)?(?:\/|$)/);
  if (shared && live(`tests/${shared[1]}/main.rs`)) {
    const area = targets.find((t) => t.name === shared[1]);
    if (!area || !area.modules.some((m) => m.name === shared[2])) return [`--test ${shared[1]}`];
    return [`--test ${area.name} -- ${shared[2]}::`, ...area.modules.filter((m) => m.name !== shared[2] && WORD_MATCH(m.text, shared[2])).map((m) => `--test ${area.name} -- ${m.name}::`)];
  }
  if (shared) return naming(targets, shared[1]);
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
