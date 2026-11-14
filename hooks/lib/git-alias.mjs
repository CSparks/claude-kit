// git-alias.mjs — the git call an alias stands for, so a gate judges `git x` as the `git clean -fdx` it runs (KIT-T1163).
// It fails closed: a subcommand it cannot show to be a known git command comes back `unresolved`, and the caller treats it as
// a call that may remove files it does not name.
//
//   expandGitAlias(git, cwd, { untrusted }) -> git
//     git: gitCommand(...) output; cwd: where the call runs (`git -C` applies on top)
//     untrusted: the caller saw the command write or redirect git configuration (git-discards.mjs)
//     the same shape with the alias replaced by its words and `args` after them; an alias of an alias is followed to
//     MAX_ALIAS_DEPTH. `unresolved: <reason>` marks a call whose subcommand is not provably a known command: a shell alias
//     (`!cmd`), a chain past the depth limit, a call whose alias sources cannot be reproduced (`git.redirected`: --git-dir,
//     --work-tree, --config-env, an include; or `untrusted`), and a subcommand that is neither a git command nor an alias.
//   mayBeAlias(sub) -> boolean   true when `sub` is no built-in git command, so it needs resolving
//
// An alias is read from the call's own `-c alias.<name>=...` first, then from the configuration git itself reads in the
// checkout (`git config --get-regexp ^alias\.`, includes followed). A built-in command cannot be shadowed by an alias, so a
// built-in subcommand costs no lookup. A subcommand that is no alias counts as known only when git lists it
// (`git --list-cmds=main,others`: the git-core commands and the `git-<name>` programs on PATH).

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
const listed = new Map();

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

// The commands git itself lists in `dir`; an empty set when git cannot say.
function knownCommands(dir) {
  if (!listed.has(dir)) {
    const listing = gitTry(['--list-cmds=main,others'], dir);
    listed.set(dir, new Set(listing.ok ? listing.out.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean) : []));
  }
  return listed.get(dir);
}

const unresolved = (git, reason) => ({ ...git, unresolved: reason });

export function expandGitAlias(git, cwd, trust = {}, depth = 0) {
  if (!git.sub || BUILTIN.has(git.sub) || git.unresolved) return git;
  if (git.redirected || trust.untrusted) return unresolved(git, `git ${git.sub}: its alias settings may come from an option, the environment or configuration this command writes`);
  if (depth >= MAX_ALIAS_DEPTH) return unresolved(git, `git ${git.sub}: an alias chain deeper than ${MAX_ALIAS_DEPTH}`);
  const where = resolve(cwd, toPath(git.dir));
  const value = git.config[`alias.${git.sub}`] ?? configuredAliases(where)[git.sub];
  if (value === undefined) return knownCommands(where).has(git.sub) ? git : unresolved(git, `git ${git.sub}: not a git command or alias`);
  if (value.trim().startsWith('!')) return unresolved(git, `git ${git.sub}: a shell alias (${value.trim()})`);
  const inner = gitCommand(shellArgs(value));
  return expandGitAlias({ ...git, sub: inner.sub, args: [...inner.args, ...git.args], config: { ...git.config, ...inner.config }, redirected: git.redirected || inner.redirected }, cwd, trust, depth + 1);
}
