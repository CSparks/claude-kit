// q-registry.mjs — `--registry <crate-version>` for `q code|sym|file` (KIT-T392): search one
// dependency crate's source tree, in the cargo registry or in a repo's vendor dir, with the same
// filters and row format as a repo search but absolute paths. A scan of that one directory: a crate
// is bounded, so there is no index to build or keep fresh.
//
//   resolveCrate(spec, { root, cwd })   -> { dir, label }; throws with the candidates when ambiguous
//   registryRows(cmd, args, { root, cwd }) -> the verb's rows over the crate (args hold --registry)
//
// spec is `<crate>-<version>` (rapier3d-0.25.1) or a bare `<crate>`, which resolves to the one
// version the nearest Cargo.lock pins (else the one copy on disk).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { describe } from './code-index-source.mjs';
import { codeVerbRows } from './code-index-query.mjs';

const SPEC = /^(.+?)-(\d+\.\d+\.\d+.*)$/;
const LOCKED = /\[\[package\]\]\s*name = "([^"]+)"\s*version = "([^"]+)"/g;
const MANIFEST_VERSION = /^version\s*=\s*"([^"]+)"/m;
const SKIP = new Set(['target', '.git', 'node_modules']);
const VENDOR_DEPTH = 4;
const VENDOR_DIR = 'vendor';

const fwd = (p) => p.replace(/\\/g, '/');
const subdirs = (dir) => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };

/** Split `--registry <spec>` / `--registry=<spec>` out of the args: { spec, rest }. */
export function takeRegistry(args) {
  const rest = [];
  let spec;
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '--registry') spec = String(args[++i] ?? '');
    else if (a.startsWith('--registry=')) spec = a.slice('--registry='.length);
    else rest.push(args[i]);
  }
  return { spec, rest };
}

const cargoHome = () => process.env.CARGO_HOME || join(homedir(), '.cargo');

function registrySources() {
  const src = join(cargoHome(), 'registry', 'src');
  return subdirs(src).map((d) => join(src, d));
}

// Every `vendor` directory under the repo, a few levels deep, submodules included.
function vendorDirs(root) {
  const found = [];
  const visit = (dir, depth) => {
    for (const name of subdirs(dir)) {
      if (name === VENDOR_DIR) { found.push(join(dir, name)); continue; }
      if (depth < VENDOR_DEPTH && !SKIP.has(name) && !name.startsWith('.')) visit(join(dir, name), depth + 1);
    }
  };
  visit(root, 1);
  return found;
}

const manifestVersion = (dir) => {
  try { return MANIFEST_VERSION.exec(readFileSync(join(dir, 'Cargo.toml'), 'utf8'))?.[1] || null; } catch { return null; }
};

// Every copy of `name` on disk: [{ version, dir, where }].
function copiesOf(name, root) {
  const out = [];
  const prefix = `${name}-`;
  for (const src of registrySources()) {
    for (const d of subdirs(src)) {
      const m = d.startsWith(prefix) && SPEC.exec(d);
      if (m && m[1] === name) out.push({ version: m[2], dir: join(src, d), where: 'registry' });
    }
  }
  for (const v of vendorDirs(root)) {
    for (const d of subdirs(v)) {
      if (d === name) out.push({ version: manifestVersion(join(v, d)), dir: join(v, d), where: 'vendor' });
      else if (d.startsWith(prefix) && SPEC.exec(d)?.[1] === name) out.push({ version: SPEC.exec(d)[2], dir: join(v, d), where: 'vendor' });
    }
  }
  return out;
}

// Versions of `name` the nearest Cargo.lock (cwd upward to the repo root) pins.
function lockedVersions(name, root, cwd) {
  let dir = resolve(cwd);
  const top = resolve(root);
  const inside = !relative(top, dir).startsWith('..');
  if (!inside) dir = top;
  for (;;) {
    const lock = join(dir, 'Cargo.lock');
    if (existsSync(lock)) {
      const versions = new Set();
      for (const m of readFileSync(lock, 'utf8').matchAll(LOCKED)) if (m[1] === name) versions.add(m[2]);
      return [...versions];
    }
    if (dir === top || dirname(dir) === dir) return [];
    dir = dirname(dir);
  }
}

const list = (name, copies) => copies.map((c) => `${name}-${c.version || '?'} (${c.where}: ${fwd(c.dir)})`).join('\n  ');

/** The crate source directory `spec` names: { dir, label }. Throws, listing the candidates, when it cannot pick exactly one. */
export function resolveCrate(spec, { root, cwd = process.cwd() }) {
  const m = SPEC.exec(spec);
  const name = m ? m[1] : spec;
  const copies = copiesOf(name, root);
  let version = m ? m[2] : null;
  if (!version) {
    const locked = lockedVersions(name, root, cwd);
    if (locked.length > 1) throw new Error(`'${spec}' is locked at ${locked.length} versions: ${locked.map((v) => `${name}-${v}`).join(', ')}. Name one: --registry ${name}-<version>`);
    version = locked[0] || null;
    if (!version) {
      if (copies.length === 1) version = copies[0].version;
      else throw new Error(copies.length ? `'${spec}' matches ${copies.length} copies on disk; name one with --registry ${name}-<version>:\n  ${list(name, copies)}` : `no crate '${spec}' in the cargo registry (${fwd(join(cargoHome(), 'registry', 'src'))}) or a vendor dir under ${fwd(root)}.`);
    }
  }
  const hit = copies.find((c) => c.version === version);
  if (!hit) throw new Error(`${name}-${version} is not on disk (cargo registry or a vendor dir). ${copies.length ? `Present:\n  ${list(name, copies)}` : 'No copy of that crate is present; run cargo fetch.'}`);
  return { dir: hit.dir, label: hit.version ? `${name}-${hit.version}` : name };
}

function crateFiles(dir) {
  const files = [];
  const visit = (rel) => {
    let entries;
    try { entries = readdirSync(join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory() && !e.isSymbolicLink() && !SKIP.has(e.name)) visit(child);
      else if (e.isFile()) { const rec = describe(dir, child); if (rec) files.push(rec); }
    }
  };
  visit('');
  return files;
}

/** Rows of `q <cmd> <args…> --registry <spec>`: the repo verbs run over the crate dir, paths made absolute. */
export async function registryRows(cmd, args, { root, cwd = process.cwd() }) {
  const { spec, rest } = takeRegistry(args);
  if (!spec) return [{ loc: '', text: 'usage: q code|sym|file … --registry <crate-version | crate>' }];
  const { dir } = resolveCrate(spec, { root, cwd });
  const rows = await codeVerbRows(cmd, rest, dir, async () => ({ handle: null, files: crateFiles(dir) }));
  return rows.map((r) => (r.loc ? { ...r, loc: `${fwd(dir)}/${r.loc}` } : r));
}
