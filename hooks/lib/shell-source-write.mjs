// A shell command or script that WRITES a source file by hand (redirect, tee, mv/rm/cp, sed/perl -i,
// a PowerShell cmdlet, `node -e`, a heredoc or scratch script). Source changes through the Edit and
// Write tools, where pre-write checks length, comments and literals; a shell write skips them.
// This is the shell twin of pre-write's code checks (check-id source-shell-write, KIT-T648).
//
//   shellSourceWrites(command, { readScript, tempDir, shell }) -> [{ path, ambiguous?, outsideTo? }]   every hit
//     ambiguous: the quoting could not be split and the command holds a write token (KIT-T705)
//     outsideTo: a proven cp/mv source operand; the gate lifts it when that destination leaves the repo
//     deletes: an operand of rm, del, erase, unlink or Remove-Item; the gate lifts it for an untracked file the caller wrote
//     mtimeOnly: { noCreate } an operand of a provably mtime-only `touch`; the gate lifts it for an existing file (touch-target.mjs)
//   shellSourceWrite(command, options) -> the first hit without outsideTo, or null
//   isSourcePath(path, tempDir) -> boolean   a hand-authored source path (not temp, build output or a vendored tree)
//   isGeneratedPath(path) -> boolean   a path under target, node_modules, dist, build or .git

import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { toPath } from './shell-segments.mjs';
import { FS_WRITE, readTempScript, scanAllShellWrites } from './shell-write-scan.mjs';
import { writeCallTargets } from './shell-write-target.mjs';

const SOURCE_EXT = 'rs|js|mjs|cjs|jsx|ts|tsx|vue|svelte|py|go|java|kt|swift|c|h|cc|cpp|hpp|cs|rb|php|sh|bash|ps1|lua|sql|wgsl|glsl|rhai|css|scss';
const SOURCE_FILE = new RegExp(`\\.(?:${SOURCE_EXT})$`, 'i');
const QUOTED_SOURCE = new RegExp(`['"\`]([^'"\`\\s]+\\.(?:${SOURCE_EXT}))['"\`]`, 'gi');
const MODULE_SPECIFIER = /\b(?:from|import|require)\s*\(?\s*(['"`])[^'"`\n]*\1/g;
const GENERATED_DIR = /(?:^|\/)(?:target|node_modules|dist|build|\.git)\//;
const DEVICE = /^\/dev\//;

export const AMBIGUOUS_PATH = '(ambiguous quoting)';

const slashed = (p) => String(p).replace(/\\/g, '/');
const SHORT_NAME = /~\d/;

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

// Every hit of the command. A hit tagged `outsideTo` is a source operand of a proven cp or mv: the gate drops it when
// that destination lands outside every adopted repo, and keeps every other hit.
export function shellSourceWrites(command, { readScript = readTempScript, tempDir = tmpdir(), shell = '' } = {}) {
  const hit = (path) => (isSourcePath(path, tempDir) ? { path: slashed(path) } : null);
  const codeHit = (code) => {
    if (!FS_WRITE.test(code)) return null;
    const targets = writeCallTargets(code);
    if (targets) return targets.map(hit).find(Boolean) || null;
    for (const m of code.replace(MODULE_SPECIFIER, ' ').matchAll(QUOTED_SOURCE)) { const h = hit(m[1]); if (h) return h; }
    return null;
  };
  return scanAllShellWrites(command, { hit, codeHit, readScript, exemptByDestination: true, shell, ambiguous: () => ({ path: AMBIGUOUS_PATH, ambiguous: true }) });
}

/** The first hit no destination can lift, or null: what a scan alone proves. */
export const shellSourceWrite = (command, options) => shellSourceWrites(command, options).find((h) => !h.outsideTo) || null;
