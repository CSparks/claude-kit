// The operand text of a delete (`rm`, `del`, `unlink`, `Remove-Item`): the text after the command word up to the first
// segment boundary (`;`, `&&`, `||`, `|`, `&`, newline) outside quotes, a `$(...)` or `(...)` group and a backtick span,
// so a later command of the same string (a wrapped shell's `rm -rf build && meson setup ...; echo $?`) is not read as an
// operand. A redirection operator (`>|`, `>&`, `<&`, `&>`) is no boundary.
//
//   deleteOperandText(argText, shell) -> string   `shell` is 'bash', 'powershell', 'cmd' or '' (unknown)
//   isStatusParameter(word) -> boolean   true for a bare `$?`, `$!`, `$$` or `$#`: a number, never a file
//
// The cut fails closed: where the scan meets a construct it does not model (a `$'...'` or `$"..."` string, a `case`
// statement, a substitution inside double quotes, an escape character of an unknown shell, a quoting the segment splitter
// calls ambiguous, a typographic quote under PowerShell or an unknown shell, a heredoc or a hash inside a group that is not
// part of a word or a parameter) it cuts nothing and every remaining word is judged as an operand.

import { belongsToRedirection } from './redirection-operator.mjs';
import { readsTypographicQuote, segments, TYPOGRAPHIC_QUOTE } from './shell-segments.mjs';

const STATUS_PARAMETER = /^\$[?!$#]$/;
const WHITESPACE = /\s/;
const CASE_WORD = 'case';
const CASE_LEAD = /[\s;&|(]/;
const PLAIN_HASH_LEAD = /[\w${]/;
const UNKNOWN_SHELL_ESCAPE = /[`^]|\\["'();|&]/;

const BASH = { escape: '\\', quotes: `"'`, boundary: ';|&\n', escapesInDouble: true, backtickSpan: true };
const RULES = {
  bash: BASH,
  powershell: { escape: '`', quotes: `"'`, boundary: ';|&\n', escapesInDouble: true, backtickSpan: false },
  cmd: { escape: '^', quotes: '"', boundary: '|&\n', escapesInDouble: false, backtickSpan: false },
};

export const isStatusParameter = (word) => STATUS_PARAMETER.test(word);

const opensCase = (text, i) => text.startsWith(CASE_WORD, i)
  && (i === 0 || CASE_LEAD.test(text[i - 1]))
  && (i + CASE_WORD.length === text.length || WHITESPACE.test(text[i + CASE_WORD.length]));

// A hash is plainly no comment only inside a word (`a#b`) or as a parameter (`$#`, `${#x}`); after any other character it may start one.
const opensCommentOrHeredoc = (text, i) => text.startsWith('<<', i)
  || (text[i] === '#' && (i === 0 || !PLAIN_HASH_LEAD.test(text[i - 1])));

const opensSubstitution = (text, i, rules) => (text[i] === '$' && text[i + 1] === '(') || (text[i] === '`' && rules.backtickSpan);

export function deleteOperandText(argText, shell = '') {
  const text = String(argText);
  const known = RULES[shell];
  if (!known && UNKNOWN_SHELL_ESCAPE.test(text)) return text;
  if (readsTypographicQuote(shell) && TYPOGRAPHIC_QUOTE.test(text)) return text;
  const rules = known || BASH;
  let quote = '';
  let depth = 0;
  let backtick = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === rules.escape && (!quote || (quote === '"' && rules.escapesInDouble))) { i++; continue; }
    if (quote) {
      if (ch === quote) quote = '';
      else if (quote === '"' && opensSubstitution(text, i, rules)) return text;
      continue;
    }
    if (rules.quotes.includes(ch)) {
      if (text[i - 1] === '$') return text;
      quote = ch;
      continue;
    }
    if (opensCase(text, i)) return text;
    if ((depth > 0 || backtick) && opensCommentOrHeredoc(text, i)) return text;
    if (ch === '`' && rules.backtickSpan) { backtick = !backtick; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0 || backtick || !rules.boundary.includes(ch)) continue;
    if ((ch === '|' || ch === '&') && belongsToRedirection(text, i)) continue;
    const cut = text.slice(0, i);
    return segments(cut, { shell }).ambiguous ? text : cut;
  }
  return text;
}
