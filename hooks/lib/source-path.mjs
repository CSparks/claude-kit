// What counts as a hand-authored source path (check-id source-shell-write, KIT-T648), shared by the shell write scan and move-lines.
//
//   SOURCE_EXT           the source file extensions, `rs|js|...`, as a regex alternation body
//   slashed(path)        the path with forward slashes
//   isSourcePath(path, tempDir) -> boolean   a hand-authored source path (not temp, build output or a vendored tree)
//   isGeneratedPath(path) -> boolean   a path under target, node_modules, dist, build or .git

import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { toPath } from './shell-segments.mjs';

export const SOURCE_EXT = 'rs|js|mjs|cjs|jsx|ts|tsx|vue|svelte|py|go|java|kt|swift|c|h|cc|cpp|hpp|cs|rb|php|sh|bash|ps1|lua|sql|wgsl|glsl|rhai|css|scss';
const SOURCE_FILE = new RegExp(`\\.(?:${SOURCE_EXT})$`, 'i');
const GENERATED_DIR = /(?:^|\/)(?:target|node_modules|dist|build|\.git)\//;
const DEVICE = /^\/dev\//;
const SHORT_NAME = /~\d/;

export const slashed = (p) => String(p).replace(/\\/g, '/');

// A Windows 8.3 short path (C:/Users/CHRISS~1/...) names the same file as its long form: expand it through its nearest
// existing ancestor so a temp or scratchpad path is recognised whichever way it is spelled.
function expandShortNames(p) {
  if (!SHORT_NAME.test(p)) return p;
  let head = p;
  const tail = [];
  while (head && !existsSync(head)) {
    const cut = head.lastIndexOf('/');
    if (cut <= 0) return p;
    tail.unshift(head.slice(cut + 1));
    head = head.slice(0, cut);
  }
  try { return [slashed(realpathSync.native(head)), ...tail].join('/'); } catch { return p; }
}

/** A path under a build-output or vendored directory (target, node_modules, dist, build, .git): nothing hand-authored lives there. */
export const isGeneratedPath = (path) => GENERATED_DIR.test(slashed(toPath(path)));

export function isSourcePath(path, tempDir = tmpdir()) {
  const p = expandShortNames(slashed(toPath(path)));
  if (!SOURCE_FILE.test(p) || GENERATED_DIR.test(p) || DEVICE.test(p)) return false;
  const temp = expandShortNames(slashed(tempDir)).toLowerCase();
  return !(p.toLowerCase().startsWith(`${temp}/`) || /^\/tmp\//.test(p));
}
