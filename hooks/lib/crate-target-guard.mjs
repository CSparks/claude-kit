// crate-target-guard.mjs — a Cargo workspace member crate with a manifest but no build target stops every cargo command in the
// workspace ("no targets specified in the manifest") for every writer until the target exists (KIT-T1533). The sibling of
// crate-folder-gate, which covers the member folder with no manifest. Fail-open: a workspace or glob this cannot read judges nothing.
//
//   crateMissingTarget(file) -> null | { crate, rel, member, workspace }
//     `file` is a path just written; `crate` is the nearest folder above it with a package manifest, a member of the enclosing
//     workspace (`member` the matching pattern, `workspace` its manifest) that has no src/lib.rs, src/main.rs, src/bin target or
//     existing [lib] / [[bin]] path.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { MANIFEST, WORKSPACE_TABLE, listOf, matching, slash } from './crate-folder-gate.mjs';

const DEFAULT_TARGETS = ['src/lib.rs', 'src/main.rs'];
const BIN_DIR = 'src/bin';
const DECLARED_PATH = /^\s*path\s*=\s*(["'])([^"']+)\1/m;
const TARGET_TABLE = /^\s*(?:\[lib\]|\[\[bin\]\])\s*(?:#.*)?$/;
const ANY_TABLE = /^\s*\[/;

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

// The `path = "…"` values of the manifest's [lib] and [[bin]] tables.
function declaredPaths(text) {
  const paths = [];
  let inTarget = false;
  for (const line of text.split(/\r?\n/)) {
    if (ANY_TABLE.test(line)) inTarget = TARGET_TABLE.test(line);
    else if (inTarget) { const m = DECLARED_PATH.exec(line); if (m) paths.push(m[2]); }
  }
  return paths;
}

function autoBinExists(crate) {
  const dir = join(crate, BIN_DIR);
  try {
    return readdirSync(dir, { withFileTypes: true }).some((e) => (e.isFile() ? e.name.endsWith('.rs') : isFile(join(dir, e.name, 'main.rs'))));
  } catch {
    return false;
  }
}

function hasTarget(crate, manifestText) {
  if (DEFAULT_TARGETS.some((t) => isFile(join(crate, t)))) return true;
  if (autoBinExists(crate)) return true;
  return declaredPaths(manifestText).some((p) => isFile(resolve(crate, p)));
}

export function crateMissingTarget(file) {
  try {
    if (!file || !isAbsolute(String(file))) return null;
    let crate = null;
    for (let dir = dirname(resolve(file)); ; dir = dirname(dir)) {
      const manifest = join(dir, MANIFEST);
      if (existsSync(manifest)) {
        const text = readFileSync(manifest, 'utf8');
        if (!crate) {
          if (WORKSPACE_TABLE.test(text)) return null;
          crate = { dir, text };
        } else if (WORKSPACE_TABLE.test(text)) {
          const rel = slash(relative(dir, crate.dir));
          const member = matching(listOf(text, 'members'), rel);
          if (!member || matching(listOf(text, 'exclude'), rel) || hasTarget(crate.dir, crate.text)) return null;
          return { crate: crate.dir, rel, member, workspace: manifest };
        }
      }
      if (dirname(dir) === dir) return null;
    }
  } catch {
    return null;
  }
}
