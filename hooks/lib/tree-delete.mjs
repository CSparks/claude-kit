// Which paths a shell delete command removes inside a checkout: the delete commands of a command
// line (rm, rmdir, del, Remove-Item), their targets resolved against the cwd (following `cd`), kept
// when they sit inside `root` and are not build output or .git. A path the shell would expand
// ($VAR, $(…), `…`, %VAR%, ~) is unknown, so it is never resolved against the checkout; a `cd` to
// one leaves the directory unknown for the relative paths that follow.
//
//   treeDeleteTargets(command, root, cwd, shell) -> absolute paths
//     shell: 'bash' | 'powershell', shellOfTool of the hook payload; omitted, the quoting rules of an unknown shell apply
// The words of each segment come from shell-lexer.mjs, read by the same shell rules as the segment split. A word whose
// shell reading differs from its written one (a bash backslash before a letter: `C:\dev\x`) is judged by both; the shell
// reading is skipped only when it names no existing path and holds no glob, so it removes nothing.

import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { msysToNative } from './msys-path.mjs';
import { segments, cdTarget } from './shell-segments.mjs';
import { words } from './shell-lexer.mjs';

const DELETE_CMD = /^(?:rm|rmdir|del|erase|unlink|remove-item|ri)$/i;
const DELETE_WORD = /\b(?:rm|rmdir|del|erase|unlink|remove-item|ri)\b/i;
const BUILD_OUTPUT = new Set(['target', 'node_modules', 'dist', 'build']);

const EXPANDS = /[$`]|%[^%\s]+%|^["']?~/;
const GLOB = /[*?[]/;

// The readings of one operand word: as written, and as the shell reads it when that differs.
const readings = ({ value, literal }) => (value === literal ? [{ path: literal }] : [{ path: literal }, { path: value, shellOnly: true }]);

// The directory after a `cd`: null while it cannot be known (an expanded path, or a relative step from an unknown one).
const moveTo = (here, dir) => (EXPANDS.test(dir) || (here === null && !isAbsolute(dir)) ? null : resolve(here ?? '', dir));

const within = (base, abs) => {
  const rel = relative(base, abs);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

// With ambiguous quoting no path can be resolved: a delete word anywhere makes the whole checkout the target.
export function treeDeleteTargets(command, root, cwd, shell = '') {
  const parts = segments(command, { shell });
  if (parts.ambiguous) return DELETE_WORD.test(command) ? [root] : [];
  const hits = [];
  let here = cwd;
  for (const { text } of parts) {
    const dir = cdTarget(text.trim());
    if (dir) { here = moveTo(here, dir); continue; }
    const tok = words(text, { shell });
    if (!tok.length || !DELETE_CMD.test(tok[0].value.replace(/.*[\\/]/, ''))) continue;
    for (const word of tok.slice(1)) {
      if (EXPANDS.test(word.raw)) continue;
      for (const { path: reading, shellOnly } of readings(word)) {
        if (reading.startsWith('-')) continue;
        const path = msysToNative(reading);
        if (here === null && !isAbsolute(path)) continue;
        const abs = resolve(here ?? '', path);
        if (shellOnly && !GLOB.test(reading) && !existsSync(abs)) continue;
        const top = relative(root, abs).split(/[\\/]/)[0];
        if (within(root, abs) && !BUILD_OUTPUT.has(top) && top !== '.git' && !hits.includes(abs)) hits.push(abs);
      }
    }
  }
  return hits;
}
