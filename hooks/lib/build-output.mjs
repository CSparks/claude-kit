// Is a path build output a tool wrote, not source a hand wrote? (source-shell-write, KIT-T1160)
//
//   buildOutputJudge(root, { markerStands, ignoredStands }) -> (path) -> boolean
//     `path` (absolute, or relative to `root`) sits below `root`, is not tracked by git, and either
//       - an ancestor directory strictly below `root` holds a REAL build-tree marker that `markerStands(markerRel)`
//         vouches for and that sits in a directory with no tracked file, or
//       - git ignores it and `ignoredStands` holds.
//     A real marker agrees with its place and the repo: CMakeCache.txt whose CMAKE_CACHEFILE_DIR is its own directory and
//     whose CMAKE_HOME_DIRECTORY is the repo or inside it; compile_commands.json, a non-empty array of { directory, file }
//     whose directories resolve inside the repo; build.ninja with `ninja_required_version` and a rule or build section
//     that sits beside a CMakeCache.txt or compile_commands.json that stands.
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

const normalized = (p) => (process.platform === 'win32' ? p.replace(/\\/g, '/').toLowerCase() : p);
const cacheValue = (text, key) => (text.match(new RegExp(`^${key}:[A-Z]+=(.*)$`, 'm')) || [])[1]?.trim() || '';

// Each check reads the marker's text against its own place: `dir` is the marker's directory, `top` the repo root, and
// `sibling(name)` whether another marker of that directory stands. Content alone is writable by anyone, so it must agree
// with where the file sits and with the repo it claims to build.
const MARKER_CHECKS = {
  'CMakeCache.txt': (text, { dir, top }) => {
    const cacheDir = cacheValue(text, 'CMAKE_CACHEFILE_DIR');
    const home = cacheValue(text, 'CMAKE_HOME_DIRECTORY');
    return Boolean(cacheDir) && Boolean(home) && samePath(cacheDir, dir) && within(top, home);
  },
  'build.ninja': (text, { sibling }) => text.includes('ninja_required_version') && /^(?:rule|build) /m.test(text)
    && (sibling('CMakeCache.txt') || sibling('compile_commands.json')),
  'compile_commands.json': (text, { dir, top }) => {
    const entries = JSON.parse(text);
    return Array.isArray(entries) && entries.length > 0
      && entries.every((e) => e && typeof e.file === 'string' && typeof e.directory === 'string' && within(top, resolve(dir, e.directory)));
  },
};
const MARKER_WORDS = /(?:^|[^\w.-])(?:CMakeCache\.txt|build\.ninja|compile_commands\.json)(?![\w.-])/i;
const IGNORE_FILES = /\.gitignore|info[\\/]exclude|core\.excludesfile/i;

export const markerMentioned = (command) => MARKER_WORDS.test(String(command || ''));
export const ignoreEditMentioned = (command) => IGNORE_FILES.test(String(command || ''));

// `parent` is `child` or holds it, whichever way each is spelled (case, slashes, 8.3 or symlinked ancestors).
function within(parent, child) {
  const rel = relative(realPath(resolve(parent)), realPath(resolve(child)));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
const samePath = (a, b) => normalized(realPath(resolve(a))) === normalized(realPath(resolve(b)));

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
  const standing = (dirRel, name) => {
    const path = join(top, dirRel, name);
    if (!existsSync(path) || !markerStands(join(dirRel, name).replace(/\\/g, '/'))) return false;
    try {
      const sibling = (other) => other !== name && standing(dirRel, other);
      return MARKER_CHECKS[name](readFileSync(path, 'utf8'), { dir: join(top, dirRel), top, sibling });
    } catch { return false; }
  };
  const verifiedTree = (dirRel) => {
    if (!verified.has(dirRel)) verified.set(dirRel, Object.keys(MARKER_CHECKS).some((name) => standing(dirRel, name)) && !holdsTracked(top, dirRel));
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
