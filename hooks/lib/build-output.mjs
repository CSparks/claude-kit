// Is a path build output a tool wrote, not source a hand wrote? (source-shell-write, KIT-T1160)
//
//   buildOutputJudge(root, { markerStands, ignoredStands }) -> (path) -> boolean
//     `path` (absolute, or relative to `root`) sits below `root`, is not tracked by git, and either
//       - an ancestor directory strictly below `root` holds a REAL build-tree marker that `markerStands(markerRel)`
//         vouches for and that sits in a directory with no tracked file, or
//       - git ignores it and `ignoredStands` holds.
//     A real marker is CMakeCache.txt with CMAKE_HOME_DIRECTORY and CMAKE_CACHEFILE_DIR, build.ninja with
//     `ninja_required_version` or a `rule `, or compile_commands.json, a non-empty array of { directory, file }.
//     The repo root's own markers never count. The caller decides what vouching means: the after-the-fact
//     detector accepts only a marker that existed before the call and was left unchanged by it; the shell gate
//     (which runs before the command) refuses a command that names a marker or an ignore file.
//   markerMentioned(command) / ignoreEditMentioned(command) -> boolean   the command text names a marker file / an ignore file
//
// The exemption covers every untracked file below a verified build tree: configure_file output mirrors the source tree,
// so no fixed list of generated subdirectories is complete.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { gitTry } from './exec.mjs';

const MARKER_CHECKS = {
  'CMakeCache.txt': (text) => text.includes('CMAKE_HOME_DIRECTORY') && text.includes('CMAKE_CACHEFILE_DIR'),
  'build.ninja': (text) => text.includes('ninja_required_version') || /^rule /m.test(text),
  'compile_commands.json': (text) => {
    const entries = JSON.parse(text);
    return Array.isArray(entries) && entries.length > 0 && entries.every((e) => e && typeof e.directory === 'string' && typeof e.file === 'string');
  },
};
const MARKER_WORDS = /(?:^|[^\w.-])(?:CMakeCache\.txt|build\.ninja|compile_commands\.json)(?![\w.-])/i;
const IGNORE_FILES = /\.gitignore|info[\\/]exclude|core\.excludesfile/i;

export const markerMentioned = (command) => MARKER_WORDS.test(String(command || ''));
export const ignoreEditMentioned = (command) => IGNORE_FILES.test(String(command || ''));

const readsAsMarker = (path, name) => {
  try { return MARKER_CHECKS[name](readFileSync(path, 'utf8')); } catch { return false; }
};

const tracked = (root, rel) => gitTry(['ls-files', '--error-unmatch', '--', rel], root).ok;
const holdsTracked = (root, dirRel) => gitTry(['ls-files', '--', dirRel], root).out.trim() !== '';
const ignored = (root, rel) => gitTry(['check-ignore', '-q', '--', rel], root).ok;

// The path with its nearest existing ancestor resolved to its real spelling (a Windows 8.3 or symlinked temp path names the repo too).
const realPath = (abs) => {
  const tail = [];
  let head = abs;
  while (!existsSync(head) && dirname(head) !== head) { tail.unshift(basename(head)); head = dirname(head); }
  try { return join(realpathSync.native(head), ...tail); } catch { return abs; }
};

export function buildOutputJudge(root, { markerStands = () => true, ignoredStands = true } = {}) {
  const top = realPath(resolve(root));
  const verified = new Map();
  const verifiedTree = (dirRel) => {
    if (!verified.has(dirRel)) {
      const marker = Object.keys(MARKER_CHECKS).find((name) => existsSync(join(top, dirRel, name))
        && markerStands(join(dirRel, name).replace(/\\/g, '/')) && readsAsMarker(join(top, dirRel, name), name));
      verified.set(dirRel, Boolean(marker) && !holdsTracked(top, dirRel));
    }
    return verified.get(dirRel);
  };
  const markedAncestor = (rel) => {
    for (let up = dirname(rel); up !== '.'; up = dirname(up)) if (verifiedTree(up)) return true;
    return false;
  };
  return (path) => {
    const rel = relative(top, realPath(resolve(root, path)));
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return false;
    if (markedAncestor(rel)) return !tracked(top, rel);
    return ignoredStands && ignored(top, rel);
  };
}
