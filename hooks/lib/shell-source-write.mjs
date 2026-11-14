// A shell command or script that WRITES a source file by hand (redirect, tee, mv/rm/cp, sed/perl -i,
// a PowerShell cmdlet, `node -e`, a heredoc or scratch script). Source changes through the Edit and
// Write tools, where pre-write checks length, comments and literals; a shell write skips them.
// This is the shell twin of pre-write's code checks (check-id source-shell-write, KIT-T648).
//
//   shellSourceWrites(command, { readScript, tempDir, shell }) -> [{ path, ambiguous?, outsideTo? }]   every hit
//     ambiguous: the quoting could not be split and the command holds a write token (KIT-T705)
//     outsideTo: a proven cp/mv source operand; the gate lifts it when that destination leaves the repo
//     deletes: an operand of rm, del, erase, unlink or Remove-Item, or of a git call that deletes or hides files (`discard`: the
//       verb, git-discards.mjs); the gate lifts it for an untracked file the caller wrote
//     copyVariable: { tool, operand, name, reason } on the hits of a cp or mv that names a variable the command does not resolve (copy-variable.mjs)
//     unresolved: a delete operand a variable or substitution supplies that the command does not resolve; never lifted
//     sweep: a git call that may take files it does not name (`git clean`, `git stash -u` with no path); lifted while no other writer is live
//     mtimeOnly: { noCreate } an operand of a provably mtime-only `touch`; the gate lifts it for an existing file (touch-target.mjs)
//   shellSourceWrite(command, options) -> the first hit without outsideTo, or null
//   isSourcePath(path, tempDir) -> boolean   a hand-authored source path (not temp, build output or a vendored tree)
//   isGeneratedPath(path) -> boolean   a path under target, node_modules, dist, build or .git

import { tmpdir } from 'node:os';
import { FS_WRITE, readTempScript, scanAllShellWrites } from './shell-write-scan.mjs';
import { writeCallTargets } from './shell-write-target.mjs';
import { SOURCE_EXT, isGeneratedPath, isSourcePath, slashed } from './source-path.mjs';

export { isGeneratedPath, isSourcePath };

const QUOTED_SOURCE = new RegExp(`['"\`]([^'"\`\\s]+\\.(?:${SOURCE_EXT}))['"\`]`, 'gi');
const MODULE_SPECIFIER = /\b(?:from|import|require)\s*\(?\s*(['"`])[^'"`\n]*\1/g;

export const AMBIGUOUS_PATH = '(ambiguous quoting)';

// A removal the scan cannot tie to one file: the gate refuses an `unresolved` operand, and a `sweep` while another writer is live.
const REMOVALS = {
  unresolved: (operand) => ({ path: operand, unresolved: operand }),
  sweep: ({ verb, path, what }) => ({ path, sweep: what, discard: verb, deletes: true }),
};

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
  return scanAllShellWrites(command, { hit, codeHit, readScript, exemptByDestination: true, removals: REMOVALS, shell, ambiguous: () => ({ path: AMBIGUOUS_PATH, ambiguous: true }) });
}

/** The first hit no destination can lift, or null: what a scan alone proves. */
export const shellSourceWrite = (command, options) => shellSourceWrites(command, options).find((h) => !h.outsideTo) || null;
