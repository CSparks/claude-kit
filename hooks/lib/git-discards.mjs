// git-discards.mjs — the git calls that delete, hide or overwrite files of the work tree, read the way a gate reads an `rm`
// (KIT-T1163): `git clean` (untracked files), `git rm -f` (a tracked file whatever its local changes), `git stash` push, save
// or bare (every tracked change leaves the shared work tree; `-u` or `-a` takes untracked files too), `git checkout [<rev>] --
// <path>`, `git restore <path>` and `git reset --hard` (local changes are overwritten), `git pull` and `git rebase` (an autostash
// or a rebase moves every tracked change, whatever the configuration says) and `git merge --autostash`, which is refused whether
// or not another writer is live (KIT-T1266), and the forcing forms `git switch -f|--discard-changes`, `git checkout-index -f`,
// `git read-tree -u` with `--reset` or `-m`, `git worktree remove --force`, `git submodule update --force` (each a sweep of
// every tracked file with local changes). A plain `git rm`, `git rm --cached`, a `-n` dry run, `git restore --staged`, a stash
// action that only reads or restores an entry (list, show, pop, apply, drop ...), a plain merge, a branch switch and a
// `git submodule update` remove nothing another writer could lose, so they are not judged.
//
//   gitDiscard({ sub, args }, { dir, cwd }) -> null | { verb, files, sweep }
//     files: the operands that name one file, as written (the caller joins `dir`, git's `-C`, in front)
//     sweep: '' when every operand names one file, else the operand text that does not (no operand, a directory, a glob, a
//            pathspec magic, paths read from a file, an unresolved variable): what the call may take beyond named files
//   discardHits(text, ctx) -> [hit]
//     the hits of every git call in the segment `text`, found past wrappers and in commands it runs (lead-command-walk.mjs);
//     ctx: { hit, cwd, shell, vars, raw, removals: { sweep({ verb, path, what }) -> hit } }
//     a call outside the allow-list of git-call-policy.mjs is a sweep; any other call's named file the caller's `hit`
//     accepts is returned tagged `deletes: true, discard: <verb>`
//   discardsBlind(text) -> boolean
//     the fallback for a command whose quoting cannot be trusted: true when any piece, cut on every operator, runs a git call
//     outside the allow-list or one of the discards above

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { commandName } from './command-lead.mjs';
import { gitCallProblem } from './git-call-policy.mjs';
import { rawGitCall } from './git-run-commands.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { leadCommandHits } from './lead-command-walk.mjs';
import { blindSegments, toPath } from './shell-segments.mjs';
import { expandVariables } from './shell-variables.mjs';

const GLOB_OR_MAGIC = /[*?[\]]|^:/;
const ABSOLUTE_PATH = /^(?:[A-Za-z]:)?[\\/]/;
const UNRESOLVED = /[$`]/;
const STASH_ACTIONS = new Set(['list', 'show', 'pop', 'apply', 'drop', 'clear', 'branch', 'create', 'store', 'export', 'import']);
const SUBSTITUTION_START = /[<>$]?\(|`/;
const WORD_SEPARATOR = /[\s"'`]+/;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NO_VALUE = '';
const WHOLE_TREE = 'every file under the directory';
const LOCAL_CHANGES = 'every tracked file with local changes';
const PATHSPEC_FROM_FILE = '--pathspec-from-file';
const OUTSIDE_ALLOW_LIST = 'a git call outside the allow-list';

const flagNames = (token) => (token.startsWith('--') ? [token.slice(2).split('=')[0]] : [...token.slice(1)]);

// Splits git's arguments into the flag names given, the operands before `--` and the ones after it (`dashed`, with
// `separated` true when `--` appeared), and the file `--pathspec-from-file` reads its paths from. A flag that takes a value
// (`-e pattern`, `-m msg`) swallows the next token; a short one only as the last letter of its bundle, one of `shortValues`.
function parse(args, { shortValues = NO_VALUE, longValues = [] } = {}) {
  const flags = new Set();
  const operands = [];
  const dashed = [];
  let pathspecFile = '';
  let separated = false;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (separated) dashed.push(token);
    else if (token === '--') separated = true;
    else if (token.startsWith('-') && token.length > 1) {
      flagNames(token).forEach((f) => flags.add(f));
      if (token.startsWith(PATHSPEC_FROM_FILE)) pathspecFile = token.includes('=') ? token.split('=').slice(1).join('=') : args[i + 1] || '';
      const takes = token.startsWith('--') ? [...longValues, PATHSPEC_FROM_FILE].includes(token) : [...shortValues].some((c) => token.endsWith(c));
      if (takes) i++;
    } else operands.push(token);
  }
  return { flags, operands, dashed, separated, pathspecFile };
}

const isDirectory = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };
const exists = (path) => { try { statSync(path); return true; } catch { return false; } };

// Operands that name exactly one file, and the operand text that may name more.
function classify(operands, { dir, cwd }) {
  const files = [];
  let sweep = operands.length ? '' : WHOLE_TREE;
  for (const operand of operands) {
    const wide = GLOB_OR_MAGIC.test(operand) || UNRESOLVED.test(operand) || /[\\/]$/.test(operand) || /^\.{1,2}$/.test(operand)
      || isDirectory(resolve(cwd, toPath(dir), toPath(operand)));
    if (wide) sweep ||= operand;
    else files.push(operand);
  }
  return { files, sweep };
}

const forced = (flags) => flags.has('f') || flags.has('force');
const includesUntracked = (flags) => ['u', 'a', 'include-untracked', 'all'].some((f) => flags.has(f));
const dryRun = (flags) => flags.has('n') || flags.has('dry-run');

// The call's judgement: its named files, and a sweep when an operand is wide or the paths come from a file.
function judged(verb, parsed, named, ctx) {
  const found = classify(named, ctx);
  if (parsed.flags.has('pathspec-from-file')) found.sweep = `paths read from ${parsed.pathspecFile || 'a file'}`;
  return { verb, ...found };
}

function cleanOf(args, ctx) {
  const parsed = parse(args, { shortValues: 'e', longValues: ['--exclude'] });
  return dryRun(parsed.flags) ? null : judged('git clean', parsed, [...parsed.operands, ...parsed.dashed], ctx);
}

function removeOf(args, ctx) {
  const parsed = parse(args);
  const { flags } = parsed;
  const named = [...parsed.operands, ...parsed.dashed];
  if (!forced(flags) || flags.has('cached') || dryRun(flags) || (!named.length && !flags.has('pathspec-from-file'))) return null;
  return judged('git rm -f', parsed, named, ctx);
}

// `git stash [push|save] [-u|-a] [-m msg] [-- pathspec...]`; `save` takes its message as a bare word, never a pathspec. A stash
// of any kind moves every named (or, bare, every) tracked change out of the shared work tree; only the actions that read or
// restore a stash entry are not judged.
// Git reads an action only as the FIRST token after `stash`; with an option first the call is a push whatever follows.
const readsOrRestoresStash = (args) => STASH_ACTIONS.has(args[0] || '');
function stashOf(args, ctx) {
  const parsed = parse(args, { shortValues: 'm', longValues: ['--message'] });
  const { flags, operands, dashed } = parsed;
  if (readsOrRestoresStash(args)) return null;
  const action = args[0] === 'push' || args[0] === 'save' ? args[0] : '';
  const pathspecs = action === 'save' ? dashed : [...operands.slice(action === 'push' ? 1 : 0), ...dashed];
  const found = judged(includesUntracked(flags) ? 'git stash -u' : 'git stash', parsed, pathspecs, ctx);
  // An option first makes the call a push whatever words follow: bare words there are not a pathspec git would read, so the call is wide.
  if (!action && operands.length) found.sweep ||= operands.join(' ');
  return found;
}

// `git pull` and `git rebase` stash, rewrite or move every tracked file with local changes (an autostash, `rebase.autoStash`,
// `pull.rebase`, a rebase of a dirty tree), whatever the configuration says; with `--autostash` (also `git merge --autostash`)
// the call is refused whether or not another writer is live (KIT-T1266).
const INTEGRATION = 'every tracked file with local changes: an autostash or a rebase moves them out of the work tree';
const integrationOf = (verb) => (args) => {
  const autostash = parse(args).flags.has('autostash');
  return { verb: autostash ? `${verb} --autostash` : verb, files: [], sweep: INTEGRATION, always: autostash };
};

// Git configuration is shared by every writer of the checkout, and many keys change what a later pull, rebase, merge or fetch does
// (`pull.rebase`, `merge.autoStash`, `rebase.autoStash`, `branch.<name>.rebase`, `include.path`, ...): no recogniser of a write is
// sound (abbreviated options, option values, new subcommands), so the READ side is an exact allowlist over the raw tokens and a
// `git config` call is a sweep unless every token fits it: an optional single scope flag, an optional --show-origin and/or
// --show-scope (each once), then exactly one of `--get <key>`, `--get-all <key>`, `--get-regexp <pattern>`, `--list`, `-l`,
// `get <key>`, `list`, where <key> and <pattern> are single tokens that do not start with `-`. Nothing is parsed.
const CONFIG_SCOPE_FLAGS = new Set(['--global', '--local', '--system', '--worktree']);
const CONFIG_ORIGIN_FLAGS = new Set(['--show-origin', '--show-scope']);
const CONFIG_READ_WITH_ARGUMENT = new Set(['--get', '--get-all', '--get-regexp', 'get']);
const CONFIG_READ_ALONE = new Set(['--list', '-l', 'list']);
function plainConfigRead(args) {
  const tokens = [...args];
  if (CONFIG_SCOPE_FLAGS.has(tokens[0])) tokens.shift();
  const origins = new Set();
  while (CONFIG_ORIGIN_FLAGS.has(tokens[0]) && !origins.has(tokens[0])) origins.add(tokens.shift());
  if (tokens.length === 1) return CONFIG_READ_ALONE.has(tokens[0]);
  return tokens.length === 2 && CONFIG_READ_WITH_ARGUMENT.has(tokens[0]) && !tokens[1].startsWith('-');
}
const CONFIG_CHANGE = 'git configuration, which every writer of this checkout shares';
const configOf = (args) => (plainConfigRead(args) ? null : { verb: 'git config', files: [], sweep: CONFIG_CHANGE, always: false });

// `git checkout [<rev>] -- <path>...`, or `git checkout <path>` when the operand exists on disk; -f overwrites everything.
function checkoutOf(args, ctx) {
  const parsed = parse(args, { shortValues: 'bB', longValues: ['--orphan', '--conflict', '--track'] });
  const { flags, operands, dashed, separated } = parsed;
  if (flags.has('b') || flags.has('B') || flags.has('orphan') || flags.has('p') || flags.has('patch')) return null;
  if (forced(flags)) return { verb: 'git checkout -f', files: [], sweep: LOCAL_CHANGES };
  const onDisk = (p) => exists(resolve(ctx.cwd, toPath(ctx.dir), toPath(p)));
  const paths = separated ? dashed : operands.filter(onDisk);
  if (!paths.length && !flags.has('pathspec-from-file')) return null;
  return judged('git checkout', parsed, paths, ctx);
}

// `git restore [--source=<rev>] [--staged] [--worktree] <path>...`: the work tree is written unless only `--staged` is given.
function restoreOf(args, ctx) {
  const parsed = parse(args, { shortValues: 's', longValues: ['--source'] });
  const { flags } = parsed;
  const indexOnly = (flags.has('staged') || flags.has('S')) && !flags.has('worktree') && !flags.has('W');
  const named = [...parsed.operands, ...parsed.dashed];
  if (indexOnly || flags.has('p') || flags.has('patch') || (!named.length && !flags.has('pathspec-from-file'))) return null;
  // Only the bare form `git restore -- <path>...` carries the verb a main thread may lift (KIT-T1286); any option is another verb.
  return judged(flags.size === 0 ? 'git restore' : 'git restore (with options)', parsed, named, ctx);
}

function resetOf(args) {
  return parse(args).flags.has('hard') ? { verb: 'git reset --hard', files: [], sweep: LOCAL_CHANGES } : null;
}

// Calls that overwrite local changes only in their forcing form, each a sweep of every tracked file with local changes.
const FORCING = {
  switch: { verb: 'git switch -f', forces: ({ flags }) => forced(flags) || flags.has('discard-changes') },
  'checkout-index': { verb: 'git checkout-index -f', forces: ({ flags }) => forced(flags) },
  'read-tree': { verb: 'git read-tree -u', forces: ({ flags }) => flags.has('u') && (flags.has('reset') || flags.has('m')) },
  worktree: { verb: 'git worktree remove --force', forces: ({ flags, operands }) => operands[0] === 'remove' && forced(flags) },
  submodule: { verb: 'git submodule update --force', forces: ({ flags, operands }) => operands[0] === 'update' && forced(flags) },
};
const forcingOf = (sub) => (args) => (FORCING[sub].forces(parse(args)) ? { verb: FORCING[sub].verb, files: [], sweep: LOCAL_CHANGES } : null);

const JUDGES = { clean: cleanOf, rm: removeOf, stash: stashOf, checkout: checkoutOf, restore: restoreOf, reset: resetOf, pull: integrationOf('git pull'), rebase: integrationOf('git rebase'), merge: integrationOf('git merge'), config: configOf, ...Object.fromEntries(Object.keys(FORCING).map((sub) => [sub, forcingOf(sub)])) };

/** The call's judgement: null when it removes nothing a writer could lose, else { verb, files, sweep }. */
export function gitDiscard({ sub, args }, ctx) {
  const judge = JUDGES[sub];
  return judge ? judge(args, ctx) : null;
}

function hitsOfCall(words, ctx) {
  const git = gitCommand(words.slice(1));
  // The walker strips a leading `$` from a word, so a variable no segment assigned shows only in the call's own text.
  const open = UNRESOLVED.test(ctx.text);
  const base = git.dir && !open ? git.dir : '.';
  const sweep = (verb, what, always = false) => ctx.removals.sweep({ verb, path: `${base}/*`, what, always });
  const problem = gitCallProblem(rawGitCall(ctx.text) || git, { lead: ctx.lead, raw: ctx.raw, shell: ctx.shell });
  const outside = problem ? [sweep(OUTSIDE_ALLOW_LIST, problem)] : [];
  const found = gitDiscard(git, { dir: git.dir, cwd: ctx.cwd });
  if (!found) return outside;
  const at = (p) => (git.dir && !ABSOLUTE_PATH.test(p) ? `${git.dir}/${p}` : p);
  const files = found.files.map((p) => ctx.hit(at(p))).filter(Boolean).map((h) => ({ ...h, deletes: true, discard: found.verb }));
  const wide = found.sweep || (open ? WHOLE_TREE : '');
  const hits = [...outside, ...files, ...(wide ? [sweep(found.verb, wide, found.always)] : [])];
  return ctx.nested ? hits.map((h) => ({ ...h, from: h.from || ctx.cwd })) : hits;
}

export const discardHits = (text, ctx) => leadCommandHits(expandVariables(text, ctx.vars, ctx.shell), ctx, { isLead: (name) => /^git$/i.test(name), hitsOf: hitsOfCall });

// A discard by sub name and flags, for a line whose structure is unknown: any `restore` except index-only, a hard reset, a
// checkout that forces or names paths after `--`.
function discardsBlindly({ sub, args }) {
  const parsed = parse(args);
  const { flags, separated } = parsed;
  return (Object.hasOwn(FORCING, sub) && FORCING[sub].forces(parsed)) || sub === 'clean' || (sub === 'rm' && forced(flags)) || (sub === 'stash' && !readsOrRestoresStash(args)) || sub === 'pull' || sub === 'rebase' || sub === 'merge' || (sub === 'config' && !plainConfigRead(args))
    || (sub === 'reset' && flags.has('hard')) || (sub === 'restore' && !flags.has('staged') && !flags.has('S'))
    || (sub === 'checkout' && (forced(flags) || separated));
}

export function discardsBlind(text) {
  return blindSegments(text).flatMap((piece) => piece.text.split(SUBSTITUTION_START)).some((piece) => {
    const words = piece.split(WORD_SEPARATOR).filter(Boolean);
    const at = words.findIndex((w) => /^git$/i.test(commandName(w)));
    if (at < 0) return false;
    const git = gitCommand(words.slice(at + 1));
    const lead = words.slice(0, at).filter((w) => ENV_ASSIGN.test(w) || w.startsWith('-') || /^env$/i.test(commandName(w)));
    return Boolean(gitCallProblem(git, { lead, raw: text, blind: true })) || discardsBlindly(git);
  });
}
