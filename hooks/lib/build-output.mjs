// Is a path build output a tool wrote, not source a hand wrote? (source-shell-write, KIT-T1160)
//
//   isBuildOutput(root, path) -> boolean   `path` (absolute, or relative to `root`) sits below `root` and either
//     git ignores it or an ancestor directory strictly below `root` holds a build-tree marker (CMakeCache.txt,
//     build.ninja, compile_commands.json) and git does not track the file. The repo root's own markers never count
//     (a clangd compile_commands.json there says nothing about the sources), and a tracked file is never output.

import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { gitTry } from './exec.mjs';

const BUILD_MARKERS = ['CMakeCache.txt', 'build.ninja', 'compile_commands.json'];
const markedDirs = new Map();

const holdsMarker = (dir) => {
  if (!markedDirs.has(dir)) markedDirs.set(dir, BUILD_MARKERS.some((name) => existsSync(join(dir, name))));
  return markedDirs.get(dir);
};

const markedAncestor = (root, rel) => {
  for (let up = dirname(rel); up !== '.'; up = dirname(up)) if (holdsMarker(join(root, up))) return true;
  return false;
};

const tracked = (root, rel) => gitTry(['ls-files', '--error-unmatch', '--', rel], root).ok;
const ignored = (root, rel) => gitTry(['check-ignore', '-q', '--', rel], root).ok;

// The path with its nearest existing ancestor resolved to its real spelling (a Windows 8.3 or symlinked temp path names the repo too).
const realPath = (abs) => {
  const tail = [];
  let head = abs;
  while (!existsSync(head) && dirname(head) !== head) { tail.unshift(basename(head)); head = dirname(head); }
  try { return join(realpathSync.native(head), ...tail); } catch { return abs; }
};

export function isBuildOutput(root, path) {
  const top = realPath(resolve(root));
  const rel = relative(top, realPath(resolve(root, path)));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return false;
  if (markedAncestor(top, rel) && !tracked(top, rel)) return true;
  return ignored(top, rel);
}
