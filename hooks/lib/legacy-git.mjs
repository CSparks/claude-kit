// A git command that changes legacy files (KIT-T989): staging, restoring, removing or committing a path under the frozen
// directory, or moving a file OUT of it. `git mv <src> legacy/...` (moving IN), staging or committing such a move by
// path (`movedIn`), and read-only git pass.
//
//   gitLegacyWrite(tokens, underLegacy, cwd, movedIn) -> null | { path, op }
//     tokens       the words after `git` (quotes stripped)
//     underLegacy  (path, base) -> bool, `base` being the directory the global `git -C <dir>` options moved to
//     movedIn      (path, base) -> bool, true when nothing under the path changed except by unchanged git renames
//
// Only the options BEFORE the subcommand are git's global options: `-C <dir>` there moves the working directory, while
// the same letters after it are the subcommand's own value options (`git commit -C <commit>`) and move nothing.

import { resolve } from 'node:path';

const CHANGING = new Set(['add', 'checkout', 'restore', 'rm', 'reset', 'clean', 'commit', 'stash', 'update-index', 'apply']);
const STAGING = new Set(['add', 'commit']);
const GLOBAL_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix']);
const DIR_OPTION = '-C';
const VALUE_OPTIONS = new Set([
  '-m', '--message', '-F', '--file', '--author', '--date', '--pathspec-from-file',
  '-C', '-c', '--reuse-message', '--reedit-message', '-t', '--template', '--cleanup',
]);

// { base, sub, rest }: the working directory after the global -C options, the subcommand and the words after it.
function parseInvocation(tokens, cwd) {
  let base = cwd;
  let i = 0;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === DIR_OPTION && tokens[i + 1] !== undefined) base = resolve(base, tokens[i + 1]);
    i += GLOBAL_VALUE_OPTIONS.has(tokens[i]) ? 2 : 1;
  }
  return { base, sub: tokens[i], rest: tokens.slice(i + 1) };
}

// The non-option words, with the value of an option that takes one (a commit message) left out.
function operands(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (VALUE_OPTIONS.has(rest[i])) i++;
    else if (!rest[i].startsWith('-')) out.push(rest[i]);
  }
  return out;
}

export function gitLegacyWrite(tokens, underLegacy, cwd = process.cwd(), movedIn = () => false) {
  const { base, sub, rest } = parseInvocation(tokens, cwd);
  const found = (paths) => paths.find((p) => underLegacy(p, base));
  if (sub === 'mv') {
    const source = found(operands(rest).slice(0, -1));
    return source ? { path: source, op: 'git mv out of legacy' } : null;
  }
  if (!CHANGING.has(sub)) return null;
  const staged = STAGING.has(sub);
  const path = found(operands(rest).filter((p) => !(staged && movedIn(p, base))));
  return path ? { path, op: `git ${sub}` } : null;
}
