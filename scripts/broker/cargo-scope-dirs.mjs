// cargo-scope-dirs.mjs — the files a cargo build compiles, so a write into them while it runs can be refused (KIT-T1114).
// The build-budget shim records the answer in its hold; hooks/lib/build-write-hold.mjs reads it.
//
//   compiledPaths(args, cwd, cargo?) -> absolute directories and files the build reads: the selected packages' directories
//     and, of every path dependency they reach (from `cargo metadata --offline`), its manifest, build script and library
//     source directories (never its tests, benches or examples), plus the workspace's Cargo.toml,
//     Cargo.lock and .cargo. A selected package holds its whole directory minus the tests/, benches/ and examples/
//     directories of the target kinds the command does not compile (cargo-build-kinds.mjs), each recorded as a "!path"
//     entry; dev-only path dependencies are skipped when no test, bench or example is built. The selection is `-p`/`--package` names, `--workspace`/`--all`, else the member holding `cwd`,
//     else the default members. When metadata cannot be read the scope is `cwd` whole: the side that keeps the guard.
//   selection(args)                  -> { names, workspace } as the command line states it
//   scopeOf(metadata, picked, cwd, kinds?) -> the paths for an already-read metadata document
//   inScope(file, scope)             -> whether a write to `file` lands in a recorded scope (held paths minus "!" paths)

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { ALL_KINDS, builtKinds } from './cargo-build-kinds.mjs';

const METADATA_TIMEOUT_MS = 20000;
const METADATA_BUFFER_BYTES = 1 << 28;
const ROOT_FILES = ['Cargo.toml', 'Cargo.lock', '.cargo', 'rust-toolchain', 'rust-toolchain.toml'];
const NOT_COMPILED_KINDS = new Set(['test', 'bench', 'example', 'bin']);
const TARGET_DIR_KINDS = new Set(['test', 'bench', 'example']);
const DEV_DEPENDENCY = 'dev';
const NOT_COMPILED_MARK = '!';
const BUILD_SCRIPT_KIND = 'custom-build';
const slash = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

export function selection(args) {
  const names = [];
  let workspace = false;
  const list = [...args];
  for (let i = 0; i < list.length; i += 1) {
    const a = String(list[i]);
    if (a === '--') break;
    if (a === '--workspace' || a === '--all') workspace = true;
    else if (a === '-p' || a === '--package') names.push(String(list[(i += 1)] ?? ''));
    else if (a.startsWith('--package=')) names.push(a.slice('--package='.length));
    else if (a.startsWith('-p=')) names.push(a.slice('-p='.length));
  }
  return { names: names.filter(Boolean), workspace };
}

function readMetadata(cwd, cargo) {
  const r = spawnSync(cargo, ['metadata', '--offline', '--format-version', '1'], { cwd, encoding: 'utf8', timeout: METADATA_TIMEOUT_MS, maxBuffer: METADATA_BUFFER_BYTES, windowsHide: true, shell: /\.(cmd|bat)$/i.test(cargo) });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

const manifestDir = (pkg) => dirname(pkg.manifest_path);
const holdsCwd = (pkg, cwd) => slash(cwd) === slash(manifestDir(pkg)) || slash(cwd).startsWith(`${slash(manifestDir(pkg))}/`);

function roots(meta, { names, workspace }, cwd) {
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const members = meta.workspace_members.map((id) => byId.get(id)).filter(Boolean);
  if (workspace) return members;
  if (names.length) return members.filter((m) => names.includes(m.name));
  const here = members.filter((m) => holdsCwd(m, cwd)).sort((a, b) => manifestDir(b).length - manifestDir(a).length)[0];
  if (here) return [here];
  const defaults = (meta.workspace_default_members || []).map((id) => byId.get(id)).filter(Boolean);
  return defaults.length ? defaults : members;
}

const isDevOnly = (dep) => (dep.dep_kinds || []).length > 0 && dep.dep_kinds.every((k) => k.kind === DEV_DEPENDENCY);

export function scopeOf(meta, picked, cwd, kinds = new Set(ALL_KINDS)) {
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(((meta.resolve && meta.resolve.nodes) || []).map((n) => [n.id, n]));
  const start = roots(meta, picked, cwd);
  const seen = new Set();
  const stack = start.length ? start.map((p) => p.id) : meta.workspace_members;
  const buildsTests = kinds.has('test') || kinds.has('bench') || kinds.has('example');
  while (stack.length) {
    const id = stack.pop();
    const pkg = byId.get(id);
    if (seen.has(id) || !pkg || pkg.source) continue;
    seen.add(id);
    for (const dep of (nodes.get(id) || {}).deps || []) if (buildsTests || !isDevOnly(dep)) stack.push(dep.pkg);
  }
  const built = new Set((start.length ? start : meta.workspace_members.map((id) => byId.get(id)).filter(Boolean)).map((p) => p.id));
  const dirs = [...seen].flatMap((id) => (built.has(id) ? builtInputs(byId.get(id), kinds) : dependencyInputs(byId.get(id))));
  const files = ROOT_FILES.map((f) => join(meta.workspace_root, f));
  return [...new Set([...dirs, ...files].map((p) => (p.startsWith(NOT_COMPILED_MARK) ? NOT_COMPILED_MARK + resolve(p.slice(1)) : resolve(p))))];
}

// A built package holds its whole directory except the directories of the target kinds the command does not compile.
function builtInputs(pkg, kinds) {
  const dir = manifestDir(pkg);
  const skipped = pkg.targets.filter((t) => t.kind.length && t.kind.every((k) => TARGET_DIR_KINDS.has(k) && !kinds.has(k)));
  const compiledDirs = pkg.targets.filter((t) => !skipped.includes(t)).map((t) => slash(dirname(t.src_path)));
  const skippedDirs = skipped.map((t) => dirname(t.src_path)).filter((d) => slash(d) !== slash(dir) && !compiledDirs.some((c) => c === slash(d) || c.startsWith(`${slash(d)}/`)));
  return [dir, ...new Set(skippedDirs.map((d) => NOT_COMPILED_MARK + d))];
}

// A write is inside the scope when a held path covers it and no NOT_COMPILED_MARK path does.
export function inScope(file, scope) {
  const target = slash(file);
  const under = (s) => target === slash(s) || target.startsWith(`${slash(s)}/`);
  const held = scope.filter((s) => !s.startsWith(NOT_COMPILED_MARK));
  const skipped = scope.filter((s) => s.startsWith(NOT_COMPILED_MARK)).map((s) => s.slice(NOT_COMPILED_MARK.length));
  return held.some(under) && !skipped.some(under);
}

// A dependency of a built package compiles as a library: its manifest, build script and the source directory of each
// library-kind target. Its tests, benches, examples and bins are no input of the build. A target rooted in the package
// directory itself makes the whole directory the input.
function dependencyInputs(pkg) {
  const dir = manifestDir(pkg);
  const compiled = pkg.targets.filter((t) => !t.kind.every((k) => NOT_COMPILED_KINDS.has(k)));
  const sources = compiled.map((t) => (t.kind.includes(BUILD_SCRIPT_KIND) ? t.src_path : dirname(t.src_path)));
  return sources.some((s) => slash(s) === slash(dir)) ? [dir] : [pkg.manifest_path, ...sources];
}

export function compiledPaths(args, cwd, cargo = 'cargo') {
  try {
    const meta = readMetadata(cwd, cargo);
    return meta ? scopeOf(meta, selection(args), cwd, builtKinds(args)) : [resolve(cwd)];
  } catch {
    return [resolve(cwd)];
  }
}
