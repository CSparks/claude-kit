// Does a copy or move destination provably land outside a repo?
//   landsOutsideRepo(destination, root, cwd) -> boolean
// The destination is resolved against `cwd` (the directory the command runs in), an existing directory is NOT
// outside proof (the file would land under it by the source's name), and the path is compared with the repo root by
// realpath of the nearest existing ancestor, so a symlink or junction into the repo is inside it.

import { existsSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { toPath } from './shell-segments.mjs';

const OUTSIDE = /^\.\.(?:[\\/]|$)/;

function realPath(path) {
  let head = resolve(path);
  const tail = [];
  while (!existsSync(head)) {
    const up = dirname(head);
    if (up === head) return resolve(path);
    tail.unshift(basename(head));
    head = up;
  }
  return join(realpathSync.native(head), ...tail);
}

const isDirectory = (path) => {
  try { return statSync(path).isDirectory(); } catch { return false; }
};

export function landsOutsideRepo(destination, root, cwd) {
  if (!destination || !root) return false;
  const absolute = resolve(cwd, toPath(destination));
  if (isDirectory(absolute)) return false;
  const rel = relative(realPath(root), realPath(absolute));
  return OUTSIDE.test(rel) || isAbsolute(rel);
}
