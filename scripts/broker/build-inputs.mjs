// build-inputs.mjs — the include!() targets of a checkout: tracked files named by an
// `include!("…")` in a tracked .rs are Rust code under another extension, so they are build inputs
// beside the globs of build-globs.mjs (KIT-D097). include_str!/include_bytes! targets are data and are not.
//
//   includeTargets(cwd)       repo-relative paths of the include!() targets
//   dirtyBlocksOf(cfg, cwd)   cfg.dirtyBlocks plus the include!() targets

import { posix } from 'node:path';
import { git } from './git.mjs';

const INCLUDE = /\binclude!\s*\(\s*"([^"]+)"\s*\)/g;

export function includeTargets(cwd) {
  const found = git(['grep', '-I', '-n', '-E', 'include![[:space:]]*[(]', '--', '*.rs'], cwd);
  if (found.code !== 0) return [];
  const targets = new Set();
  for (const line of found.out.split('\n')) {
    const at = /^(.*?):\d+:(.*)$/.exec(line);
    if (!at) continue;
    for (const m of at[2].matchAll(INCLUDE)) targets.add(posix.normalize(posix.join(posix.dirname(at[1]), m[1])));
  }
  return [...targets];
}

export const dirtyBlocksOf = (cfg, cwd) => [...cfg.dirtyBlocks, ...includeTargets(cwd)];
