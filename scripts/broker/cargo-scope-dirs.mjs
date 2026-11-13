// cargo-scope-dirs.mjs — the files a cargo build compiles, so a write into them while it runs can be refused (KIT-T1114).
// The build-budget shim records the answer in its hold; hooks/lib/build-write-hold.mjs reads it.
//
//   compiledPaths(args, cwd, cargo?) -> absolute directories and files the build reads: the selected packages' directories
//     and, of every path dependency they reach (from `cargo metadata --offline`), its manifest, build script and library
//     source directories (never its tests, benches or examples), plus the workspace's Cargo.toml,
//     Cargo.lock and .cargo. The selection is `-p`/`--package` names, `--workspace`/`--all`, else the member holding `cwd`,
//     else the default members. When metadata cannot be read the scope is `cwd` whole: the side that keeps the guard.
//   selection(args)                  -> { names, workspace } as the command line states it
//   scopeOf(metadata, picked, cwd)   -> the paths for an already-read metadata document

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const METADATA_TIMEOUT_MS = 20000;
const METADATA_BUFFER_BYTES = 1 << 28;
const ROOT_FILES = ['Cargo.toml', 'Cargo.lock', '.cargo', 'rust-toolchain', 'rust-toolchain.toml'];
const NOT_COMPILED_KINDS = new Set(['test', 'bench', 'example', 'bin']);
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

export function scopeOf(meta, picked, cwd) {
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(((meta.resolve && meta.resolve.nodes) || []).map((n) => [n.id, n]));
  const start = roots(meta, picked, cwd);
  const seen = new Set();
  const stack = start.length ? start.map((p) => p.id) : meta.workspace_members;
  while (stack.length) {
    const id = stack.pop();
    const pkg = byId.get(id);
    if (seen.has(id) || !pkg || pkg.source) continue;
    seen.add(id);
    for (const dep of (nodes.get(id) || {}).deps || []) stack.push(dep.pkg);
  }
  const built = new Set((start.length ? start : meta.workspace_members.map((id) => byId.get(id)).filter(Boolean)).map((p) => p.id));
  const dirs = [...seen].flatMap((id) => (built.has(id) ? [manifestDir(byId.get(id))] : dependencyInputs(byId.get(id))));
  return [...new Set([...dirs, ...ROOT_FILES.map((f) => join(meta.workspace_root, f))].map((p) => resolve(p)))];
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
    return meta ? scopeOf(meta, selection(args), cwd) : [resolve(cwd)];
  } catch {
    return [resolve(cwd)];
  }
}
