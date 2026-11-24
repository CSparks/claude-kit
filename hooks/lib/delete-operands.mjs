// The operand text of a delete (`rm`, `del`, `unlink`, `Remove-Item`): the text after the command word up to the first
// segment boundary shell-lexer.mjs finds outside every group, substitution and backtick span, so a later command of the
// same string (a wrapped shell's `rm -rf build && meson setup ...; echo $?`) is not read as an operand.
//
//   deleteOperandText(argText, shell) -> string   `shell` is 'bash', 'powershell', 'cmd' or '' (unknown)
//   isStatusParameter(word) -> boolean   true for a bare `$?`, `$!`, `$$` or `$#`: a number, never a file
//
// The cut fails closed: a construct the lexer marks before the boundary (a `$'...'` or `$"..."` string, a case
// statement, a substitution inside double quotes, an ambiguous quoting, a comment or heredoc inside a group), or a
// typographic quote or an unknown shell's escape character anywhere, leaves the text whole, so every word is judged.

import { lex, REASON } from './shell-lexer.mjs';

const STATUS_PARAMETER = /^\$[?!$#]$/;
const ANYWHERE = new Set([REASON.typographic, REASON.unknownEscape]);

export const isStatusParameter = (word) => STATUS_PARAMETER.test(word);

export function deleteOperandText(argText, shell = '') {
  const text = String(argText);
  const { tokens, marks } = lex(text, { shell });
  if (marks.some((m) => ANYWHERE.has(m.reason))) return text;
  const boundary = tokens.find((t) => t.kind === 'op' && t.depth === 0);
  if (!boundary || marks.some((m) => m.at < boundary.start)) return text;
  return text.slice(0, boundary.start);
}
