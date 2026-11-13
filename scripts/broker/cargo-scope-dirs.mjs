// cargo-scope-dirs.mjs — the files a cargo build compiles, so a write into them while it runs can be refused (KIT-T1114).
// The build-budget shim records the answer in its hold; hooks/lib/build-write-hold.mjs reads it.
//
//   compiledPaths(args, cwd, cargo?) -> absolute directories and files the build reads: the selected packages' directories
//     and, of every path dependency they reach (from `cargo metadata --offline`), its manifest, build script and library
//     source directories (never its tests, benches or examples), plus the workspace's Cargo.toml,
//     Cargo.lock and .cargo. A selected package holds its whole directory minus the tests/, benches/ and examples/
//     directories of the target kinds the command does not compile (cargo-build-kinds.mjs), each recorded as a "!path"
//     entry; dev-only path dependencies are skipped when no test, bench or example is built. The selection is
//     `-p`/`--package` names (any package of the dependency graph, member or not), `--workspace`/`--all`, else the member
//     holding `cwd`, else the default members. A `--manifest-path` or `-C` flag moves the workspace (cargo-metadata-read.mjs).
//     Two forms the parser cannot resolve keep the guard wide and say why in `reason`: metadata that cannot be read holds the
//     workspace directory whole, a `-p` name outside the graph holds every member.
//   compiledScope(args, cwd, cargo?) -> { scope, via, reason }: the same paths, `via` mapping each held path to the
//     dependency chain that reaches it ("rg-reflections -> rg-graphics -> rg-engine"), `reason` the wide-hold cause or ''
//   selection(args)                  -> { names, workspace } as the command line states it
//   scopeOf(metadata, picked, cwd, kinds?) -> { scope, via, reason } for an already-read metadata document
//   inScope(file, scope)             -> whether a write to `file` lands in a recorded scope (held paths minus "!" paths)
//   scopeVia(file, via)              -> the chain of the most specific held path covering `file`, or ''

import { dirname, join, resolve } from 'node:path';
import { ALL_KINDS, builtKinds } from './cargo-build-kinds.mjs';
import { readMetadata, workspaceArgs } from './cargo-metadata-read.mjs';

const CHAIN_SEPARATOR = ' -> ';
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

const manifestDir = (pkg) => dirname(pkg.manifest_path);
const holdsCwd = (pkg, cwd) => slash(cwd) === slash(manifestDir(pkg)) || slash(cwd).startsWith(`${slash(manifestDir(pkg))}/`);
const specName = (spec) => String(spec).split('#').pop().split('@')[0];

// The packages a command line builds, and the reason when the selection cannot be resolved against the graph.
function roots(meta, { names, workspace }, cwd) {
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const members = meta.workspace_members.map((id) => byId.get(id)).filter(Boolean);
  if (workspace) return { picked: members, reason: '' };
  if (names.length) {
    const wanted = names.map(specName);
    const found = meta.packages.filter((p) => wanted.includes(p.name));
    const missing = wanted.filter((n) => !found.some((p) => p.name === n));
    if (!missing.length) return { picked: found, reason: '' };
    return { picked: [], reason: `-p ${missing.join(', ')} is not a package of the dependency graph at ${meta.workspace_root}, so every workspace member is held` };
  }
  const here = members.filter((m) => holdsCwd(m, cwd)).sort((a, b) => manifestDir(b).length - manifestDir(a).length)[0];
  if (here) return { picked: [here], reason: '' };
  const defaults = (meta.workspace_default_members || []).map((id) => byId.get(id)).filter(Boolean);
  return { picked: defaults.length ? defaults : members, reason: '' };
}

const isDevOnly = (dep) => (dep.dep_kinds || []).length > 0 && dep.dep_kinds.every((k) => k.kind === DEV_DEPENDENCY);

// Breadth-first from the built packages: every local package reached, with the parent that first reached it.
function closure(start, byId, nodes, buildsTests) {
  const parent = new Map();
  const order = [];
  const queue = start.map((id) => [id, null]);
  for (let i = 0; i < queue.length; i += 1) {
    const [id, from] = queue[i];
    const pkg = byId.get(id);
    if (parent.has(id) || !pkg || pkg.source) continue;
    parent.set(id, from);
    order.push(id);
    for (const dep of (nodes.get(id) || {}).deps || []) if (buildsTests || !isDevOnly(dep)) queue.push([dep.pkg, id]);
  }
  return { order, parent };
}

const markedResolve = (p) => (p.startsWith(NOT_COMPILED_MARK) ? NOT_COMPILED_MARK + resolve(p.slice(1)) : resolve(p));

export function scopeOf(meta, picked, cwd, kinds = new Set(ALL_KINDS)) {
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(((meta.resolve && meta.resolve.nodes) || []).map((n) => [n.id, n]));
  const { picked: chosen, reason } = roots(meta, picked, cwd);
  const start = chosen.length ? chosen.map((p) => p.id) : meta.workspace_members;
  const buildsTests = kinds.has('test') || kinds.has('bench') || kinds.has('example');
  const { order, parent } = closure(start, byId, nodes, buildsTests);
  const built = new Set(start);
  const chainOf = (id) => {
    const names = [];
    for (let at = id; at; at = parent.get(at)) names.unshift(byId.get(at).name);
    return names.join(CHAIN_SEPARATOR);
  };
  const via = {};
  const dirs = order.flatMap((id) => {
    const paths = (built.has(id) ? builtInputs(byId.get(id), kinds) : dependencyInputs(byId.get(id))).map(markedResolve);
    for (const p of paths) if (!p.startsWith(NOT_COMPILED_MARK)) via[p] = chainOf(id);
    return paths;
  });
  const files = ROOT_FILES.map((f) => resolve(join(meta.workspace_root, f)));
  for (const f of files) via[f] = `workspace root file of ${start.map((id) => byId.get(id).name).join(', ')}`;
  return { scope: [...new Set([...dirs, ...files])], via, reason };
}

export function scopeVia(file, via = {}) {
  const target = slash(file);
  const covering = Object.keys(via).filter((p) => target === slash(p) || target.startsWith(`${slash(p)}/`));
  covering.sort((a, b) => slash(b).length - slash(a).length);
  return covering.length ? via[covering[0]] : '';
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

export function compiledScope(args, cwd, cargo = 'cargo') {
  const where = workspaceArgs(args, cwd);
  const whole = resolve(where.manifest ? dirname(where.manifest) : where.cwd);
  const unread = (reason) => ({ scope: [whole], via: { [whole]: 'the whole workspace directory' }, reason });
  try {
    const { meta, reason } = readMetadata(args, cwd, cargo);
    return meta ? scopeOf(meta, selection(args), where.cwd, builtKinds(args)) : unread(reason);
  } catch (e) {
    return unread(`scope computation failed in ${where.cwd}: ${e && e.message}`);
  }
}

export const compiledPaths = (args, cwd, cargo = 'cargo') => compiledScope(args, cwd, cargo).scope;
