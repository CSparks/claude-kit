// The files a `git commit` would include, from `git status --porcelain -uall -- <paths>` (KIT-T1020, KIT-T1158, KIT-T1159).
//   pathspecFiles(porcelain, { staged })  -> string[]  the entries a pathspec commit takes; untracked entries only when `staged`
//   pathspecStatus(root, paths)           -> string  the porcelain of `paths`, untracked directories listed file by file
//   addsReach(command, path)              -> boolean  whether an add of the command may stage `path` (an unresolved pathspec by its literal tail)
//   sameCommandAdds(command)              -> string[]  the pathspecs of every `git add` or `git stage` in the command
//     ('.' for a bare add, -A or -u with no pathspec, a --pathspec-from-file add, a pathspec holding a variable or a find `{}`, and any add the
//     parser cannot place: it fails closed; a grouping `(`, `$(` or backtick around the add is read through)
// A `git add` earlier in the SAME command has not run when the commit gate does: its pathspecs name files the commit will
// carry, and `status -uall` lists them as files, never as a collapsed `dir/`.
// The parser reads each shell segment: global options of git (`-C`, `-c k=v`, `--git-dir`, `--no-pager`, ...) are
// walked to reach the subcommand, a bash/sh/eval string is read as a command of its own, and a segment that holds
// `git` plus an add or stage word the walk cannot place counts as an add of the whole tree.

import { execFileSync } from 'node:child_process';
import { blindSegments, segments, shellTokens } from './shell-segments.mjs';

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
const PLAIN_EXPANSION = /^\$(?:\{[A-Za-z_]\w*\}|[A-Za-z_]\w*)/;
const MAGIC_OR_ABSOLUTE = /^(?::|\/|~|[A-Za-z]:)/;
const UNPLAIN_PATH = /[*?[\]${}()`\\"'<>|;&]/;
const QUOTE_CHARS = /["']/g;
const unquoted = (token) => token.replace(QUOTE_CHARS, '');

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
// `args` keep their quotes: a pathspec holding an expansion stays quoted as written, so its quoting can be judged (addsReach).
function addPathspecs(args) {
  const plain = args.map(unquoted);
  if (plain.some((t) => FROM_FILE.test(t))) return WHOLE_TREE;
  const dashAt = plain.indexOf('--');
  const from = dashAt === -1 ? 0 : dashAt + 1;
  const paths = args.slice(from).filter((t, i) => dashAt !== -1 || !plain[from + i].startsWith('-'))
    .map((t) => (UNRESOLVED_SPEC.test(t) ? t : unquoted(t)));
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
  const entries = shellTokens(text).map((raw) => ({ raw, word: ungrouped(unquoted(raw)) })).filter((e) => e.word);
  const words = entries.map((e) => e.word);
  const argsAfter = (at) => entries.slice(at).map((e) => argWord(e.raw)).filter((t) => unquoted(t));
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

// Path components of a pathspec, null when git or the shell may read it as more than those names: a magic or absolute or
// home-relative start, a glob, a backslash, a `.` or `..` component, an expansion.
function plainComponents(spec) {
  if (MAGIC_OR_ABSOLUTE.test(spec) || UNPLAIN_PATH.test(spec)) return null;
  const parts = spec.split('/').filter(Boolean);
  return parts.some((c) => c === '.' || c === '..') ? null : parts;
}

// The literal path components a pathspec ends with after its last expansion, null when the pathspec cannot be narrowed.
// Narrowing needs each expansion to be a plain `$NAME` or `${NAME}` inside double quotes (no word splitting or globbing).
function literalTail(spec) {
  if (MAGIC_OR_ABSOLUTE.test(unquoted(spec)) || /[`\\]|\$\(/.test(spec)) return null;
  let quote = '';
  let tailAt = 0;
  for (let i = 0; i < spec.length; i++) {
    const c = spec[i];
    if (c === '"' || c === "'") quote = quote === c ? '' : quote || c;
    else if (c === '$') {
      const name = spec.slice(i).match(PLAIN_EXPANSION);
      if (!name || quote !== '"') return null;
      i += name[0].length - 1;
      tailAt = i + 1;
    }
  }
  const tail = unquoted(spec.slice(tailAt));
  return tail.startsWith('/') ? plainComponents(tail.slice(1)) : null;
}

const lower = (parts) => parts.map((c) => c.toLowerCase());
const hasRun = (parts, run) => run.length > 0 && parts.some((_, at) => run.every((c, i) => parts[at + i] === c));

/** True when a `git add` of the command may stage `path`: a bare or tree-wide add, a plain pathspec naming it or a parent of it, or a double-quoted-expansion pathspec whose literal tail can name it; any other pathspec fails closed. */
export function addsReach(command, path) {
  const target = lower(String(path).replace(/\\/g, '/').split('/').filter(Boolean));
  return rawAdds(command).some((spec) => {
    if (spec === WHOLE_TREE[0]) return true;
    if (!UNRESOLVED_SPEC.test(spec)) {
      const own = plainComponents(spec.replace(/\\/g, '/'));
      return own === null || lower(own).every((c, i) => target[i] === c);
    }
    const tail = literalTail(spec);
    return tail === null || tail.length === 0 || hasRun(target, lower(tail));
  });
}
