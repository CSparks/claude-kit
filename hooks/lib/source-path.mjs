// What counts as a hand-authored source path (check-id source-shell-write, KIT-T648), shared by the shell write scan and move-lines.
//
//   SOURCE_EXT           the source file extensions, `rs|js|...`, as a regex alternation body
//   slashed(path)        the path with forward slashes
//   isSourcePath(path, tempDir) -> boolean   a hand-authored source path (not temp, build output or a vendored tree)
//   isGeneratedPath(path) -> boolean   a path under target, node_modules, dist, build or .git

import { tmpdir } from 'node:os';
import { toPath } from './shell-segments.mjs';
import { expandShortNames } from './short-names.mjs';

export const SOURCE_EXT = 'rs|js|mjs|cjs|jsx|ts|tsx|vue|svelte|py|go|java|kt|swift|c|h|cc|cpp|hpp|cs|rb|php|sh|bash|ps1|lua|sql|wgsl|glsl|rhai|css|scss';
const SOURCE_FILE = new RegExp(`\\.(?:${SOURCE_EXT})$`, 'i');
const GENERATED_DIR = /(?:^|\/)(?:target|node_modules|dist|build|\.git)\//;
const DEVICE = /^\/dev\//;

export const slashed = (p) => String(p).replace(/\\/g, '/');

/** A path under a build-output or vendored directory (target, node_modules, dist, build, .git): nothing hand-authored lives there. */
export const isGeneratedPath = (path) => GENERATED_DIR.test(slashed(toPath(path)));

/** A path under the temp directory (the session scratchpad lives there) or /tmp, in either spelling of a Windows path. */
export function isTempPath(path, tempDir = tmpdir()) {
  const p = expandShortNames(slashed(toPath(path)));
  const temp = expandShortNames(slashed(tempDir)).toLowerCase();
  return p.toLowerCase().startsWith(`${temp}/`) || /^\/tmp\//.test(p);
}

export function isSourcePath(path, tempDir = tmpdir()) {
  const p = expandShortNames(slashed(toPath(path)));
  if (!SOURCE_FILE.test(p) || GENERATED_DIR.test(p) || DEVICE.test(p)) return false;
  return !isTempPath(p, tempDir);
}
