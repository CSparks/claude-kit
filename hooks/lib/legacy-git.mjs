// A git command that changes legacy files (KIT-T989): staging, restoring, removing or committing a path under the frozen
// directory, or moving a file OUT of it. `git mv <src> legacy/...` (moving IN), staging or committing such a move by
// path (`movedIn`), and read-only git pass.
//
//   gitLegacyWrite(tokens, underLegacy, cwd, movedIn) -> null | { path, op }
//     tokens       the words after `git` (quotes stripped)
//     underLegacy  (path, base) -> bool, `base` being the directory a `git -C` moved to
//     movedIn      (path, base) -> bool, true when nothing under the path changed except by unchanged git renames

import { resolve } from 'node:path';
import { subcommand } from './branch-ops.mjs';

const CHANGING = new Set(['add', 'checkout', 'restore', 'rm', 'reset', 'clean', 'commit', 'stash', 'update-index', 'apply']);
const STAGING = new Set(['add', 'commit']);
const DIR_OPTION = '-C';

const VALUE_OPTIONS = new Set(['-m', '--message', '-F', '--file', '--author', '--date', '--pathspec-from-file']);

// The non-option words, with the value of an option that takes one (a commit message) left out.
function operands(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (VALUE_OPTIONS.has(rest[i])) i++;
    else if (!rest[i].startsWith('-')) out.push(rest[i]);
  }
  return out;
}

function workingDir(tokens, cwd) {
  const at = tokens.indexOf(DIR_OPTION);
  return at >= 0 && tokens[at + 1] ? resolve(cwd, tokens[at + 1]) : cwd;
}

export function gitLegacyWrite(tokens, underLegacy, cwd = process.cwd(), movedIn = () => false) {
  const { sub, rest } = subcommand(tokens);
  const base = workingDir(tokens, cwd);
  const found = (paths) => paths.find((p) => underLegacy(p, base));
  if (sub === 'mv') {
    const paths = operands(rest);
    const source = found(paths.slice(0, -1));
    return source ? { path: source, op: 'git mv out of legacy' } : null;
  }
  if (!CHANGING.has(sub)) return null;
  const staged = STAGING.has(sub);
  const path = found(operands(rest).filter((p) => !(staged && movedIn(p, base))));
  return path ? { path, op: `git ${sub}` } : null;
}
