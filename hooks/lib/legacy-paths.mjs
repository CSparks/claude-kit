// Is a path inside a repo's frozen legacy directory (`legacy_dir` in .ai/config.yml)? Comparison is on forward-slash,
// lower-cased repo-relative paths, so a Windows spelling, a drive-letter case or an MSYS `/d/x` form all land alike;
// a path that only differs by symlink or 8.3 short names is retried on its real path.
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

export function relativeTo(root, path, base = root) {
  const abs = resolve(base, toPath(path).replace(/\\/g, '/'));
  return within(resolve(root), abs) || within(realish(resolve(root)), realish(abs));
}

export function underLegacy(root, dir, path, base = root) {
  if (!dir || !path) return false;
  const rel = relativeTo(root, path, base).toLowerCase();
  const legacy = dir.toLowerCase();
  return rel === legacy || rel.startsWith(`${legacy}/`);
}
