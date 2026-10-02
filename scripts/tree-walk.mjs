// tree-walk.mjs — the one directory walker behind the doc tree (doc-tree.mjs) and the
// structure audit (structure-audit.mjs). Yields every source-bearing directory of a repo with
// its direct files and subdirectories; never descends into build output, dot-dirs, symlinks,
// or another repo (a submodule carries its own tree).

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const SKIP_DIRS = new Set([
  'node_modules', 'target', 'dist', 'build', 'vendor', 'coverage', '__pycache__', 'out', 'bin', 'obj',
]);
export const SOURCE_EXT = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp vue svelte sql wgsl glsl rhai'.split(' '),
);
export const MANIFESTS = new Set(['Cargo.toml', 'package.json', 'pyproject.toml', 'go.mod', 'pom.xml']);
const MAX_DEPTH = 10;

export const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
export const isSource = (name) => SOURCE_EXT.has(extOf(name));

/**
 * Walk `root`. Returns Map<relDir, { files: string[], dirs: string[] }>; the root is ''.
 * Rel paths use '/'.
 */
export function walkTree(root) {
  const out = new Map();
  const visit = (rel, depth) => {
    let entries;
    try { entries = readdirSync(join(root, rel), { withFileTypes: true }); } catch { return; }
    const files = [];
    const dirs = [];
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.isFile()) files.push(e.name);
      else if (e.isDirectory()) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
        const child = rel ? `${rel}/${e.name}` : e.name;
        if (existsSync(join(root, child, '.git'))) continue; // another repo's tree
        dirs.push(e.name);
      }
    }
    out.set(rel, { files: files.sort(), dirs: dirs.sort() });
    if (depth < MAX_DEPTH) for (const d of dirs) visit(rel ? `${rel}/${d}` : d, depth + 1);
  };
  visit('', 0);
  return out;
}
