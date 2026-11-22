// redirect-writes.mjs — the files a shell command's own `>` redirects name (KIT-T1479). The PostToolUse recorder (shell-writes) calls
// it after the call ran and proves each write by the file's mtime, so a file a call redirected into another repo than the one it
// ran in is the session's own there.
//
//   redirectedFiles(command, { start, shell, bases }) -> absolute paths the command redirects into, whether or not the redirect
//     ran. A relative target is resolved against the directory after the `cd` segments before its segment, and against each of
//     `bases`.
//
// The scan fails closed: it returns nothing for a command whose control flow or quoting it cannot place (a heredoc, an escape
// before a quote, a reserved word, a `{ }` group, a `( )` subshell or function, `[[` or `((`, a backslash-escaped `>`), and only a
// plain `>` (also `2>`, `&>`) in a simple command counts: `>>` appends to a file that may be another writer's, and a redirect
// inside quotes or a comment is text.

import { isAbsolute, resolve } from 'node:path';
import { commandCwd } from './shell-cwd.mjs';
import { segments, toPath } from './shell-segments.mjs';

const UNRESOLVABLE = /[$`*?]|^&|^\/dev\/|^nul$/i;
const TRUNCATING_REDIRECT = /(?<!>)>(?![>&|])\s*([^\s"'|;&<>)`]+)/g;
const HEREDOC = /<</;
const COMMENT = /(?:^|\s)#/;
const ESCAPED_REDIRECT = /\\>/;
const QUOTED_SPAN = /"[^"]*"|'[^']*'/g;
const RESERVED_WORD = /(?:^|[\s;&|])(?:if|then|elif|else|fi|while|until|for|do|done|case|esac|select|function|time|coproc)(?=$|[\s;&|])/;
const GROUP = /(?:^|[\s;&|])[{}](?=$|[\s;&|])|[()]|\[\[|\(\(/;
const CONTROL_FLOW = new RegExp(`${RESERVED_WORD.source}|${GROUP.source}`);
const ALLOWED_OPERATORS = new Set(['start', ';', '&&']);

const blankQuoted = (text) => text.replace(QUOTED_SPAN, (span) => ' '.repeat(span.length));

function truncatingTargets(command, shell) {
  const text = String(command || '');
  const segs = segments(text, { shell });
  const bare = blankQuoted(text);
  if (segs.ambiguous || HEREDOC.test(text) || ESCAPED_REDIRECT.test(text) || CONTROL_FLOW.test(bare) || !segs.every((s) => ALLOWED_OPERATORS.has(s.after))) return [];
  return segs.flatMap((seg, index) => {
    const part = blankQuoted(seg.text);
    if (COMMENT.test(part)) return [];
    return [...part.matchAll(TRUNCATING_REDIRECT)].filter((m) => !UNRESOLVABLE.test(m[1])).map((m) => ({ target: toPath(m[1]), index }));
  });
}

export function redirectedFiles(command, { start = process.cwd(), shell = '', bases = [] } = {}) {
  const files = truncatingTargets(command, shell).flatMap(({ target, index }) => {
    if (isAbsolute(target)) return [target];
    return [commandCwd(command, start, { upto: index, shell }), ...bases].map((dir) => resolve(dir, target));
  });
  return [...new Set(files)];
}
