// Is a path inside a repo's frozen legacy directory (`legacy_dir` in .ai/config.yml)? Comparison is on forward-slash,
// lower-cased repo-relative paths, so a Windows spelling, a drive-letter case or an MSYS `/d/x` form all land alike.
// A path counts as legacy when EITHER its lexical spelling or its real path (symlinks, junctions and 8.3 short names
// resolved) lies under the directory, so an alias outside legacy/ pointing into it is frozen too.
//
//   underLegacy(root, dir, path, base) -> true when `path` (resolved against `base`, default the repo root) is `dir` or below it
//   relativeTo(root, path, base)       -> the repo-relative forward-slash path, '' when it leaves the repo

import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { toPath } from './shell-segments.mjs';

const within = (root, abs) => {
  const rel = relative(root, abs).replace(/\\/g, '/');
  return rel.startsWith('..') || isAbsolute(rel) ? '' : rel;
};

// The real path of `abs`, resolving the nearest existing ancestor and appending the part that does not exist yet.
function realish(abs) {
  try { return realpathSync.native(abs); } catch { /* not there yet */ }
  const parent = dirname(abs);
  return parent === abs ? abs : join(realish(parent), basename(abs));
}

// [lexical, real] repo-relative paths of `path`; '' where that spelling leaves the repo.
function spellings(root, path, base) {
  const abs = resolve(base, toPath(path).replace(/\\/g, '/'));
  const top = resolve(root);
  return [within(top, abs), within(realish(top), realish(abs))];
}

export const relativeTo = (root, path, base = root) => spellings(root, path, base).find(Boolean) || '';

export function underLegacy(root, dir, path, base = root) {
  if (!dir || !path) return false;
  const legacy = dir.toLowerCase();
  return spellings(root, path, base).some((rel) => {
    const lower = rel.toLowerCase();
    return lower === legacy || lower.startsWith(`${legacy}/`);
  });
}
