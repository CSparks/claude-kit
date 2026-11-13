// git-discards.mjs — the git calls that delete or hide files of the work tree, read the way a gate reads an `rm` (KIT-T1163):
// `git clean` (untracked files), `git rm -f` (a tracked file whatever its local changes), `git stash` with `-u` or `-a`
// (untracked files go into the stash). A plain `git rm`, `git rm --cached`, a `-n` dry run and a stash without
// `-u`/`-a` remove nothing another writer could lose, so they are not judged.
//
//   gitDiscard({ sub, args, dir }, cwd) -> null | { verb, files, sweep }
//     files: the operands that name one file, as written (the caller joins `dir`, git's `-C`, in front)
//     sweep: '' when every operand names one file, else the operand text that does not (no operand, a directory, a glob,
//            a pathspec magic, or a variable the command did not resolve): what the call may take beyond named files
//   discardHits(text, ctx) -> [hit]
//     the hits of every such call in the segment `text`, found past wrappers and in commands it runs (lead-command-walk.mjs);
//     ctx: { hit, cwd, shell, vars, removals: { sweep({ verb, path, what }) -> hit } }
//     a named file the caller's `hit` accepts is returned tagged `deletes: true, discard: <verb>`
//   discardsBlind(text) -> boolean
//     the fallback for a command whose quoting cannot be trusted: true when any piece, cut on every operator, runs one

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { commandName } from './command-lead.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { leadCommandHits } from './lead-command-walk.mjs';
import { blindSegments, toPath } from './shell-segments.mjs';
import { expandVariables } from './shell-variables.mjs';

const GLOB_OR_MAGIC = /[*?[\]]|^:/;
const UNRESOLVED = /[$`]/;
const STASH_ACTIONS = new Set(['list', 'show', 'pop', 'apply', 'drop', 'clear', 'branch', 'create', 'store', 'export', 'import']);
const SUBSTITUTION_START = /[<>$]?\(|`/;
const WORD_SEPARATOR = /[\s"'`]+/;
const NO_VALUE = '';
const WHOLE_TREE = 'every file under the directory';

const flagNames = (token) => (token.startsWith('--') ? [token.slice(2).split('=')[0]] : [...token.slice(1)]);

// Splits git's arguments into the flag names given, the operands before `--` and the ones after it. A flag that takes
// a value (`-e pattern`, `-m msg`) swallows the next token; a short one only as the last letter of its bundle.
function parse(args, { shortValue, longValues }) {
  const flags = new Set();
  const operands = [];
  const dashed = [];
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (literal) dashed.push(token);
    else if (token === '--') literal = true;
    else if (token.startsWith('-') && token.length > 1) {
      flagNames(token).forEach((f) => flags.add(f));
      const takes = token.startsWith('--') ? longValues.includes(token) : shortValue !== NO_VALUE && token.endsWith(shortValue);
      if (takes) i++;
    } else operands.push(token);
  }
  return { flags, operands, dashed };
}

const isDirectory = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };

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

function cleanOf(args, ctx) {
  const { flags, operands, dashed } = parse(args, { shortValue: 'e', longValues: ['--exclude'] });
  return flags.has('n') || flags.has('dry-run') ? null : { verb: 'git clean', ...classify([...operands, ...dashed], ctx) };
}

function removeOf(args, ctx) {
  const { flags, operands, dashed } = parse(args, { shortValue: NO_VALUE, longValues: [] });
  const named = [...operands, ...dashed];
  if (!forced(flags) || flags.has('cached') || flags.has('n') || flags.has('dry-run') || !named.length) return null;
  return { verb: 'git rm -f', ...classify(named, ctx) };
}

// `git stash [push|save] [-u|-a] [-m msg] [-- pathspec...]`; `save` takes its message as a bare word, never a pathspec.
function stashOf(args, ctx) {
  const { flags, operands, dashed } = parse(args, { shortValue: 'm', longValues: ['--message'] });
  const action = operands[0] || '';
  if (STASH_ACTIONS.has(action) || !includesUntracked(flags)) return null;
  const pathspecs = action === 'save' ? dashed : [...operands.slice(action === 'push' ? 1 : 0), ...dashed];
  return { verb: 'git stash -u', ...classify(pathspecs, ctx) };
}

const JUDGES = { clean: cleanOf, rm: removeOf, stash: stashOf };

export function gitDiscard({ sub, args, dir }, cwd) {
  const judge = JUDGES[sub];
  return judge ? judge(args, { dir, cwd }) : null;
}

const isDiscarder = (name, rest) => /^git$/i.test(name) && Object.hasOwn(JUDGES, gitCommand(rest).sub);

function hitsOfCall(words, ctx) {
  const git = gitCommand(words.slice(1));
  const found = gitDiscard(git, ctx.cwd);
  if (!found) return [];
  const at = (p) => (git.dir ? `${git.dir}/${p}` : p);
  const files = found.files.map((p) => ctx.hit(at(p))).filter(Boolean).map((h) => ({ ...h, deletes: true, discard: found.verb }));
  // The walker strips a leading `$` from a word, so a variable no segment assigned shows only in the call's own text.
  const open = UNRESOLVED.test(ctx.text);
  const wide = found.sweep || (open ? WHOLE_TREE : '');
  const base = git.dir && !open ? git.dir : '.';
  return wide ? [...files, ctx.removals.sweep({ verb: found.verb, path: `${base}/*`, what: wide })] : files;
}

export const discardHits = (text, ctx) => leadCommandHits(expandVariables(text, ctx.vars, ctx.shell), ctx, { isLead: isDiscarder, hitsOf: hitsOfCall });

export function discardsBlind(text) {
  return blindSegments(text).flatMap((piece) => piece.text.split(SUBSTITUTION_START)).some((piece) => {
    const words = piece.split(WORD_SEPARATOR).filter(Boolean);
    const at = words.findIndex((w) => /^git$/i.test(commandName(w)));
    if (at < 0) return false;
    const { sub, args } = gitCommand(words.slice(at + 1));
    const { flags } = parse(args, { shortValue: NO_VALUE, longValues: [] });
    return sub === 'clean' || (sub === 'rm' && forced(flags)) || (sub === 'stash' && includesUntracked(flags));
  });
}
