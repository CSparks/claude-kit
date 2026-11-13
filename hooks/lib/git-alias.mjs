// git-alias.mjs — the git call an alias stands for, so a gate judges `git x` as the `git clean -fdx` it runs (KIT-T1163).
//
//   expandGitAlias(git, cwd) -> git
//     git: gitCommand(...) output { sub, args, dir, config }; cwd: where the call runs (`git -C` applies on top)
//     the same shape with the alias replaced by its words and `args` after them; an alias of an alias is followed to
//     MAX_ALIAS_DEPTH. A shell alias (`!cmd`) runs arbitrary commands: it comes back with `shellAlias: <text>`.
//     A subcommand that is neither a built-in git command nor a defined alias comes back unchanged.
//
// An alias is read from the call's own `-c alias.<name>=...` first, then from the configuration git itself reads in the
// checkout (`git config --get-regexp ^alias\.`). A built-in command cannot be shadowed by an alias, so a built-in
// subcommand costs no lookup.

import { resolve } from 'node:path';
import { gitTry } from './exec.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { toPath, shellArgs } from './shell-segments.mjs';

const MAX_ALIAS_DEPTH = 4;
const BUILTIN = new Set(['add', 'am', 'apply', 'archive', 'bisect', 'blame', 'branch', 'bundle', 'cat-file', 'checkout', 'cherry-pick', 'clean', 'clone', 'commit', 'config',
  'count-objects', 'describe', 'diff', 'diff-index', 'diff-tree', 'fetch', 'for-each-ref', 'format-patch', 'fsck', 'gc', 'grep', 'hash-object', 'help', 'init', 'log', 'ls-files',
  'ls-tree', 'merge', 'merge-base', 'mktree', 'mv', 'name-rev', 'prune', 'pull', 'push', 'read-tree', 'rebase', 'reflog', 'remote', 'reset', 'restore', 'rev-list', 'rev-parse',
  'revert', 'rm', 'shortlog', 'show', 'show-ref', 'stash', 'status', 'submodule', 'switch', 'symbolic-ref', 'tag', 'update-ref', 'version', 'worktree', 'write-tree']);
const ALIAS_LINE = /^alias\.(\S+)\s(.*)$/;

/** True when `sub` is no built-in git command, so it may be an alias. */
export const mayBeAlias = (sub) => Boolean(sub) && !BUILTIN.has(sub);

const configured = new Map();

// The aliases git reads in `dir`, as { name: value }.
function configuredAliases(dir) {
  if (!configured.has(dir)) {
    const listing = gitTry(['config', '--get-regexp', '^alias\\.'], dir);
    const found = {};
    for (const line of listing.ok ? listing.out.split('\n') : []) {
      const m = ALIAS_LINE.exec(line.trim());
      if (m) found[m[1].toLowerCase()] = m[2];
    }
    configured.set(dir, found);
  }
  return configured.get(dir);
}

export function expandGitAlias(git, cwd, depth = 0) {
  if (!git.sub || BUILTIN.has(git.sub) || depth >= MAX_ALIAS_DEPTH) return git;
  const value = git.config[`alias.${git.sub}`] ?? configuredAliases(resolve(cwd, toPath(git.dir)))[git.sub];
  if (value === undefined) return git;
  if (value.trim().startsWith('!')) return { ...git, shellAlias: value };
  const inner = gitCommand(shellArgs(value));
  return expandGitAlias({ ...git, sub: inner.sub, args: [...inner.args, ...git.args], config: { ...git.config, ...inner.config } }, cwd, depth + 1);
}
