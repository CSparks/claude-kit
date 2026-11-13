// The files a `git commit` would include, from `git status --porcelain -uall -- <paths>` (KIT-T1020, KIT-T1158, KIT-T1159).
//   pathspecFiles(porcelain, { staged })  -> string[]  the entries a pathspec commit takes; untracked entries only when `staged`
//   sameCommandAdds(command)              -> string[]  the pathspecs of every `git add` or `git stage` in the command
//     ('.' for a bare, -A, -u or --pathspec-from-file add, and for any add the parser cannot place: it fails closed)
// A `git add` earlier in the SAME command has not run when the commit gate does: its pathspecs name files the commit will
// carry, and `status -uall` lists them as files, never as a collapsed `dir/`.
// The parser reads each shell segment: global options of git (`-C`, `-c k=v`, `--git-dir`, `--no-pager`, ...) are
// walked to reach the subcommand, a bash/sh/eval string is read as a command of its own, and a segment that holds
// `git` plus an add or stage word the walk cannot place counts as an add of the whole tree.

import { blindSegments, segments, shellArgs } from './shell-segments.mjs';

const UNTRACKED = '??';
const STATUS_COLUMNS = 'XY '.length;
const ALL_FLAGS = new Set(['-A', '--all', '-u', '--update', '.']);
const ADD_VERBS = new Set(['add', 'stage']);
const WHOLE_TREE = ['.'];
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source']);
const GIT_FLAG_OPTIONS = new Set(['-p', '-P', '--paginate', '--no-pager', '--bare', '--no-replace-objects', '--literal-pathspecs', '--glob-pathspecs',
  '--noglob-pathspecs', '--icase-pathspecs', '--no-optional-locks', '--no-lazy-fetch', '--no-advice', '--exec-path']);
const OPTION_WITH_VALUE = /^--[\w-]+=/;
const UNRESOLVED_WORD = /^[$`(]/;
const SHELL_STRING = /[\s;&|]/;
const FROM_FILE = /^--pathspec-from-file(?:=|$)/;

const baseName = (word) => word.replace(/.*[\\/]/, '').replace(/\.exe$/i, '');

export function pathspecFiles(porcelain, { staged = false } = {}) {
  return [...new Set(String(porcelain).split('\n').filter(Boolean)
    .filter((line) => staged || line.slice(0, 2) !== UNTRACKED)
    .map((line) => {
      const path = line.slice(STATUS_COLUMNS);
      return (path.includes(' -> ') ? path.split(' -> ').pop() : path).replace(/^"|"$/g, '');
    }))];
}

function addPathspecs(args) {
  if (args.some((t) => FROM_FILE.test(t))) return WHOLE_TREE;
  const dashAt = args.indexOf('--');
  const paths = dashAt === -1 ? args.filter((t) => !t.startsWith('-') || ALL_FLAGS.has(t)) : args.slice(dashAt + 1);
  return paths.length ? paths.map((t) => (ALL_FLAGS.has(t) ? '.' : t)) : WHOLE_TREE;
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
  const words = shellArgs(text);
  const gitAt = words.findIndex((w) => baseName(w) === 'git');
  if (gitAt === -1) return words.filter((w) => SHELL_STRING.test(w) && /\bgit\b/.test(w)).flatMap(sameCommandAdds);
  const subAt = subcommandAt(words, gitAt + 1);
  if (subAt === -1) return words.slice(gitAt + 1).some((w) => ADD_VERBS.has(w)) ? WHOLE_TREE : [];
  const sub = words[subAt];
  if (sub === undefined) return [];
  if (UNRESOLVED_WORD.test(sub)) return WHOLE_TREE;
  return ADD_VERBS.has(sub) ? addPathspecs(words.slice(subAt + 1)) : [];
}

export function sameCommandAdds(command) {
  const text = String(command);
  const parts = segments(text);
  const pieces = parts.ambiguous ? blindSegments(text) : parts;
  return [...new Set([...pieces].flatMap(({ text: segment }) => segmentAdds(segment)))];
}
