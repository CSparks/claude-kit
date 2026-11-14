// The text of a commit message the command text does not carry: a message file given to `git commit -F <file>`,
// `-F<file>`, `-aF <file>`, `--file <file>` or `--file=<file>` (KIT-T1019, KIT-T364).
//   commitMessageFile(command, shell?) -> { path } | { stdin: true } | null   the file the command names, `-` meaning stdin
//   commitMessageText(command, cwd, shell?) -> string                         that file's text, '' when none, stdin or unreadable
//   unreadableMessageFile(command, cwd, shell?) -> string                     the -F path as the gate resolved it, '' when readable
//   commitMessagePath(command, cwd, shell?) -> string                         the -F file as an absolute path, '' for none or stdin
// A path built from a variable the command assigns as a plain literal (`S=/x; git commit -F "$S/m.txt"`) is expanded
// first; `shell` is 'powershell' or 'bash' (default). A stdin message (`-F -`) cannot be read ahead of the commit: the
// caller judges the command text alone, which carries a heredoc body, and never blocks a citation the text already holds.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commitCall } from './git-calls.mjs';
import { expandVariables, precedingValues } from './shell-variables.mjs';
import { segments } from './shell-segments.mjs';

const MAX_MESSAGE_BYTES = 1 << 20;
const STDIN = '-';
const MSYS_DRIVE = /^\/([A-Za-z])\//;

const VALUE_OPTIONS = new Set(['-m', '-t', '-c', '-C', '--message', '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--reuse-message', '--reedit-message', '--trailer', '--pathspec-from-file']);
const SHORT_VALUE_LETTERS = /[mtcC]/;

// The words after `commit`, from the segment holding the commit with the variables the command assigned before it replaced;
// the command itself when it cannot be split.
function commitTokens(command, shell) {
  const parts = segments(command, { shell });
  const home = parts.ambiguous ? null : parts.find((seg) => commitCall(seg.text, { shell }));
  const text = home ? expandVariables(home.text, precedingValues(parts, shell).get(home), shell) : command;
  return commitCall(text, { shell })?.args ?? [];
}

export function commitMessageFile(command, shell = 'bash') {
  const tokens = commitTokens(String(command || ''), shell);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--') return null;
    const joined = t.match(/^--file=(.*)$/);
    if (joined) return joined[1] === STDIN ? { stdin: true } : { path: joined[1] };
    if (t === '--file') return tokens[i + 1] === STDIN ? { stdin: true } : tokens[i + 1] ? { path: tokens[i + 1] } : null;
    if (t.startsWith('--')) { if (VALUE_OPTIONS.has(t)) i++; continue; }
    if (!t.startsWith('-') || t === '-') continue;
    const cluster = t.slice(1);
    const at = cluster.search(/[F]/);
    const before = at < 0 ? cluster : cluster.slice(0, at);
    if (at >= 0 && !SHORT_VALUE_LETTERS.test(before)) {
      const value = cluster.slice(at + 1) || tokens[i + 1];
      if (!value) return null;
      return value === STDIN ? { stdin: true } : { path: value };
    }
    if (SHORT_VALUE_LETTERS.test(cluster.at(-1))) i++;
  }
  return null;
}

const absolutePath = (file, cwd) => resolve(cwd, file.path.replace(MSYS_DRIVE, '$1:/'));

/** The absolute path of the file a `-F` names, '' for no file or stdin. */
export function commitMessagePath(command, cwd, shell = 'bash') {
  const file = commitMessageFile(command, shell);
  return file && !file.stdin ? absolutePath(file, cwd) : '';
}

const readMessage = (file, cwd) => {
  try {
    return readFileSync(absolutePath(file, cwd), 'utf8').slice(0, MAX_MESSAGE_BYTES);
  } catch {
    return null;
  }
};

export function commitMessageText(command, cwd, shell = 'bash') {
  const file = commitMessageFile(command, shell);
  return !file || file.stdin ? '' : readMessage(file, cwd) ?? '';
}

export function unreadableMessageFile(command, cwd, shell = 'bash') {
  const file = commitMessageFile(command, shell);
  return file && !file.stdin && readMessage(file, cwd) === null ? file.path : '';
}
