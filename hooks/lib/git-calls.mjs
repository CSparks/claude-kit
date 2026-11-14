// git-calls.mjs — the git calls a shell command line makes, found by parsing the line, never by matching its text (KIT-T1174).
//
//   gitCalls(command, { shell, cwd }) -> [{ sub, args, options, dir }]
//     every git call, in order, past wrappers and env assignments (`env A=1 git`, `git.exe`, a quoted exe path), global
//     options (`-C` quoted or not and repeated, `-c k=v`, `--no-pager`, ...), and inside the commands a call runs
//     (`bash -c`, `powershell -Command`, `eval`, `ssh`, substitutions).
//     sub:     the lower-case subcommand      args: the words after it, quotes removed
//     options: the global options given, { flag, value }
//     dir:     the directory the call acts in: the `cd` segments before it (a nested string keeps its own), then each `-C` in turn
//     explicitDir: true when a `cd` segment or a `-C` option names the directory (even the one the shell is in already)
//   firstGitCall(command, subs, opts) -> call | null   the first call whose subcommand is one of `subs`
//   commitCall(command, opts) -> call | null            the first `git commit`; a line whose quoting cannot be trusted that the
//                                                      legacy pattern reads as a commit yields { unparsed: true, args: [] }
//
// Words come from quote-aware tokens, so a quoted `>`, a quoted path with a space and a `$VAR` stay whole.

import { resolve } from 'node:path';
import { leadIndex } from './command-lead.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { MAX_NESTING, cleaned, commandRuns, commandTokens } from './lead-command-walk.mjs';
import { isDirectory } from './shell-cwd.mjs';
import { blindSegments, dequoted, segments, toPath } from './shell-segments.mjs';

const DIR_FLAG = '-C';
const WINDOWS_CD_FLAG = '/d';
const COMMIT = 'commit';
const isGit = (name) => /^git$/i.test(name);
const isCd = (name) => /^(?:cd|chdir|pushd|set-location|sl)$/i.test(name);
const LEGACY_COMMIT = /\bgit\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+|--?\S+\s+)*commit\b/;

const wordsOf = (text) => cleaned(commandTokens(text)).map(dequoted);

const dirAfterGlobalOptions = (options, cwd) => options
  .filter(({ flag }) => flag === DIR_FLAG)
  .reduce((dir, { value }) => resolve(dir, toPath(value)), cwd);

function dirAfterCd(dir, words) {
  const at = leadIndex(words, isCd);
  const operand = at < 0 ? '' : words.slice(at + 1).find((w) => !w.startsWith('-') && w.toLowerCase() !== WINDOWS_CD_FLAG);
  const next = operand ? resolve(dir, toPath(operand)) : dir;
  return isDirectory(next) ? next : dir;
}

function collect(text, shell, cwd, depth, found) {
  let dir = cwd;
  let moved = false;
  const parts = segments(text, { shell });
  for (const segment of parts.ambiguous ? blindSegments(text) : parts) {
    const words = wordsOf(segment.text);
    const at = leadIndex(words, isGit);
    if (at >= 0) {
      const call = gitCommand(words.slice(at + 1));
      const named = call.options.some(({ flag }) => flag === DIR_FLAG);
      found.push({ sub: call.sub, args: call.args, options: call.options, dir: dirAfterGlobalOptions(call.options, dir), explicitDir: moved || named });
    } else if (leadIndex(words, isCd) >= 0) {
      dir = dirAfterCd(dir, words);
      moved = true;
    }
    if (depth < MAX_NESTING) commandRuns(segment.text, shell).forEach((run) => collect(run.text, run.shell, dir, depth + 1, found));
  }
}

export function gitCalls(command, { shell = 'bash', cwd = process.cwd() } = {}) {
  const found = [];
  collect(String(command), shell, cwd, 0, found);
  return found;
}

export function firstGitCall(command, subs, opts = {}) {
  try {
    return gitCalls(command, opts).find((call) => subs.includes(call.sub)) ?? null;
  } catch {
    return null;
  }
}

export function commitCall(command, { shell = 'bash', cwd = process.cwd() } = {}) {
  const text = String(command);
  let found = null;
  let trusted = true;
  try {
    found = gitCalls(text, { shell, cwd }).find((call) => call.sub === COMMIT) ?? null;
    trusted = !segments(text, { shell }).ambiguous;
  } catch {
    trusted = false;
  }
  if (found || trusted || !LEGACY_COMMIT.test(text)) return found;
  return { sub: COMMIT, args: [], options: [], dir: cwd, unparsed: true };
}
