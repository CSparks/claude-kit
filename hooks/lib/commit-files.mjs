// The files a `git commit` would include, from `git status --porcelain -uall -- <paths>` (KIT-T1020, KIT-T1158, KIT-T1159).
//   pathspecFiles(porcelain, { staged })  -> string[]  the entries a pathspec commit takes; untracked entries only when `staged`
//   pathspecStatus(root, paths)           -> string  the porcelain of `paths`, untracked directories listed file by file
//   literalAdds(command)                  -> string[]  the add pathspecs holding no shell expansion, for git to match as written (the pin check)
//   sameCommandAdds(command)              -> string[]  the pathspecs of every `git add` or `git stage` in the command
//     ('.' for a bare add, -A or -u with no pathspec, a --pathspec-from-file add, a pathspec holding a variable or a find `{}`, and any add the
//     parser cannot place: it fails closed; a grouping `(`, `$(` or backtick around the add is read through)
// A `git add` earlier in the SAME command has not run when the commit gate does: its pathspecs name files the commit will
// carry, and `status -uall` lists them as files, never as a collapsed `dir/`.
// The parser reads each shell segment: global options of git (`-C`, `-c k=v`, `--git-dir`, `--no-pager`, ...) are
// walked to reach the subcommand, a bash/sh/eval string is read as a command of its own, and a segment that holds
// `git` plus an add or stage word the walk cannot place counts as an add of the whole tree.

import { execFileSync } from 'node:child_process';
import { blindSegments, segments, shellArgs } from './shell-segments.mjs';

const UNTRACKED = '??';
const STATUS_COLUMNS = 'XY '.length;
const ADD_VERBS = new Set(['add', 'stage']);
const WHOLE_TREE = ['.'];
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source']);
const GIT_FLAG_OPTIONS = new Set(['-p', '-P', '--paginate', '--no-pager', '--bare', '--no-replace-objects', '--literal-pathspecs', '--glob-pathspecs',
  '--noglob-pathspecs', '--icase-pathspecs', '--no-optional-locks', '--no-lazy-fetch', '--no-advice', '--exec-path']);
const OPTION_WITH_VALUE = /^--[\w-]+=/;
const UNRESOLVED_WORD = /^[$`(]/;
const SHELL_STRING = /[\s;&|]/;
const FROM_FILE = /^--pathspec-from-file(?:=|$)/;

const FIND_PLACEHOLDER = '{}';
const UNRESOLVED_SPEC = /[$`]|\{\}/;
const GROUPING_AROUND_WORD = /^(?:\$\(|[({]|`(?=git\b))+|[)}]+$/g;
const ARG_GROUPING = /^[({]+|[)}]+$/g;
const STATUS_MAX_BYTES = 256 * 1024 * 1024;

const baseName = (word) => word.replace(/.*[\\/]/, '').replace(/\.exe$/i, '');
// An add's argument keeps a leading `$(` or backtick (an expansion, unresolved) and loses only the grouping that closes the call.
const argWord = (word) => (word === FIND_PLACEHOLDER ? word : word.replace(ARG_GROUPING, ''));
const ungrouped = (word) => (word === FIND_PLACEHOLDER ? word : word.replace(GROUPING_AROUND_WORD, ''));

export function pathspecFiles(porcelain, { staged = false } = {}) {
  return [...new Set(String(porcelain).split('\n').filter(Boolean)
    .filter((line) => staged || line.slice(0, 2) !== UNTRACKED)
    .map((line) => {
      const path = line.slice(STATUS_COLUMNS);
      return (path.includes(' -> ') ? path.split(' -> ').pop() : path).replace(/^"|"$/g, '');
    }))];
}

function statusOf(root, flags, paths) {
  try {
    return execFileSync('git', ['-C', root, 'status', '--porcelain', ...flags, '--', ...paths],
      { encoding: 'utf8', maxBuffer: STATUS_MAX_BYTES, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  } catch {
    return null;
  }
}

/** The porcelain of `paths`, untracked directories listed file by file; an output too large for -uall falls back to git's collapsed `dir/` entries. */
export const pathspecStatus = (root, paths) => statusOf(root, ['-uall'], paths) ?? statusOf(root, [], paths) ?? '';

// `-A`, `--all`, `-u` and `--update` widen an add to the whole tree only when no pathspec follows: `git add -A crates/a
// crates/b` stages every change under those two folders and nothing else (KIT-T1392). A bare `.` is the whole tree.
function addPathspecs(args) {
  if (args.some((t) => FROM_FILE.test(t))) return WHOLE_TREE;
  const dashAt = args.indexOf('--');
  const paths = dashAt === -1 ? args.filter((t) => !t.startsWith('-')) : args.slice(dashAt + 1);
  return paths.length ? paths : WHOLE_TREE;
}

// The subcommand index after git's global options, -1 when the walk meets an option it cannot place.
function subcommandAt(words, from) {
  let j = from;
  while (j < words.length && words[j].startsWith('-')) {
    const w = words[j];
    if (GIT_VALUE_OPTIONS.has(w)) j += 2;
    else if (GIT_FLAG_OPTIONS.has(w) || OPTION_WITH_VALUE.test(w)) j += 1;
    else return -1;
  }
  return j;
}

function segmentAdds(text) {
  const entries = shellArgs(text).map((raw) => ({ raw, word: ungrouped(raw) })).filter((e) => e.word);
  const words = entries.map((e) => e.word);
  const argsAfter = (at) => entries.slice(at).map((e) => argWord(e.raw)).filter(Boolean);
  const gitAt = words.findIndex((w) => baseName(w) === 'git');
  if (gitAt === -1) return words.filter((w) => SHELL_STRING.test(w) && /\bgit\b/.test(w)).flatMap(rawAdds);
  const subAt = subcommandAt(words, gitAt + 1);
  if (subAt === -1) return words.slice(gitAt + 1).some((w) => ADD_VERBS.has(w)) ? WHOLE_TREE : [];
  const sub = words[subAt];
  if (sub === undefined) return [];
  if (UNRESOLVED_WORD.test(sub)) return WHOLE_TREE;
  return ADD_VERBS.has(sub) ? addPathspecs(argsAfter(subAt + 1)) : [];
}

function rawAdds(command) {
  const text = String(command);
  const parts = segments(text);
  const pieces = parts.ambiguous ? blindSegments(text) : parts;
  return [...new Set([...pieces].flatMap(({ text: segment }) => segmentAdds(segment)))];
}

export const sameCommandAdds = (command) => [...new Set(rawAdds(command).map((t) => (UNRESOLVED_SPEC.test(t) ? '.' : t)))];

/** The pathspecs of the command's adds that hold no shell expansion: git can match each as written. A bare or tree-wide add is '.'. */
export const literalAdds = (command) => rawAdds(command).filter((spec) => !UNRESOLVED_SPEC.test(spec));
