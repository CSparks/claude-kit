// The text of a commit message the command text does not carry: a message file given to `git commit -F <file>`,
// `-F<file>`, `-aF <file>`, `--file <file>` or `--file=<file>` (KIT-T1019, KIT-T364).
//   commitMessageFile(command) -> { path } | { stdin: true } | null     the file the command names, `-` meaning stdin
//   commitMessageText(command, cwd) -> string                           that file's text, '' when none, stdin or unreadable
// A stdin message (`-F -`) cannot be read ahead of the commit: the caller judges the command text alone, which carries
// a heredoc body, and never blocks a citation the text already holds.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMMIT = /\bgit\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+|--?\S+\s+)*commit\b/;
const MAX_MESSAGE_BYTES = 1 << 20;
const STDIN = '-';

// Whitespace-split tokens of the commit segment, a quoted span kept whole; the segment ends at an unquoted `;`, `|` or `&`.
function commitTokens(command) {
  const m = COMMIT.exec(command);
  if (!m) return [];
  let seg = '';
  let quote = '';
  for (const ch of command.slice(m.index + m[0].length)) {
    if (quote) { seg += ch; if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; seg += ch; continue; }
    if (ch === ';' || ch === '|' || ch === '&') break;
    seg += ch;
  }
  return [...seg.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);
}

const VALUE_OPTIONS = new Set(['-m', '-t', '-c', '-C', '--message', '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--reuse-message', '--reedit-message', '--trailer', '--pathspec-from-file']);
const SHORT_VALUE_LETTERS = /[mtcC]/;

export function commitMessageFile(command) {
  const tokens = commitTokens(String(command || ''));
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

export function commitMessageText(command, cwd) {
  const file = commitMessageFile(command);
  if (!file || file.stdin) return '';
  try {
    return readFileSync(resolve(cwd, file.path), 'utf8').slice(0, MAX_MESSAGE_BYTES);
  } catch {
    return '';
  }
}
