// A shell command or script that WRITES a source file by hand (redirect, tee, mv/rm/cp, sed/perl -i,
// a PowerShell cmdlet, `node -e`, a heredoc or scratch script). Source changes through the Edit and
// Write tools, where pre-write checks length, comments and literals; a shell write skips them.
// This is the shell twin of pre-write's code checks (check-id source-shell-write, KIT-T648).
//
//   shellSourceWrite(command, { readScript, tempDir }) -> null | { path, ambiguous? }
//     ambiguous: the quoting could not be split and the command holds a write token (KIT-T705)
//   isSourcePath(path, tempDir) -> boolean   a hand-authored source path (not temp, build output or a vendored tree)

import { tmpdir } from 'node:os';
import { FS_WRITE, readTempScript, scanShellWrites } from './shell-write-scan.mjs';

const SOURCE_EXT = 'rs|js|mjs|cjs|jsx|ts|tsx|vue|svelte|py|go|java|kt|swift|c|h|cc|cpp|hpp|cs|rb|php|sh|bash|ps1|lua|sql|wgsl|glsl|rhai|css|scss';
const SOURCE_FILE = new RegExp(`\\.(?:${SOURCE_EXT})$`, 'i');
const QUOTED_SOURCE = new RegExp(`['"\`]([^'"\`\\s]+\\.(?:${SOURCE_EXT}))['"\`]`, 'gi');
const GENERATED_DIR = /(?:^|\/)(?:target|node_modules|dist|build|\.git)\//;
const DEVICE = /^\/dev\//;

export const AMBIGUOUS_PATH = '(ambiguous quoting)';

const slashed =(p) => String(p).replace(/\\/g, '/');

export function isSourcePath(path, tempDir = tmpdir()) {
  const p = slashed(path);
  if (!SOURCE_FILE.test(p) || GENERATED_DIR.test(p) || DEVICE.test(p)) return false;
  const temp = slashed(tempDir).toLowerCase();
  return !(p.toLowerCase().startsWith(`${temp}/`) || /^\/tmp\//.test(p));
}

export function shellSourceWrite(command, { readScript = readTempScript, tempDir = tmpdir() } = {}) {
  const hit = (path) => (isSourcePath(path, tempDir) ? { path: slashed(path) } : null);
  const codeHit = (code) => {
    if (!FS_WRITE.test(code)) return null;
    for (const m of code.matchAll(QUOTED_SOURCE)) { const h = hit(m[1]); if (h) return h; }
    return null;
  };
  return scanShellWrites(command, { hit, codeHit, readScript, ambiguous: () => ({ path: AMBIGUOUS_PATH, ambiguous: true }) });
}
