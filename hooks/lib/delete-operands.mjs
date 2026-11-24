// The operand text of a delete (`rm`, `del`, `unlink`, `Remove-Item`): the text after the command word up to the first
// segment boundary (`;`, `&&`, `||`, `|`, `&`, newline) outside quotes, a `$(...)` or `(...)` group and a backtick span,
// so a later command of the same string (a wrapped shell's `rm -rf build && meson setup ...; echo $?`) is not read as an
// operand. A `>&`, `&>` pair is a redirection, not a boundary.
//
//   deleteOperandText(argText) -> string
//   isStatusParameter(word) -> boolean   true for a bare `$?`, `$!`, `$$` or `$#`: a number, never a file

const STATUS_PARAMETER = /^\$[?!$#]$/;
const BOUNDARY = /[;|&\n]/;

export const isStatusParameter = (word) => STATUS_PARAMETER.test(word);

export function deleteOperandText(argText) {
  const text = String(argText);
  let quote = '';
  let depth = 0;
  let backtick = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && quote !== "'") { i++; continue; }
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '`') { backtick = !backtick; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0 || backtick || !BOUNDARY.test(ch)) continue;
    if (ch === '&' && (text[i - 1] === '>' || text[i + 1] === '>')) continue;
    return text.slice(0, i);
  }
  return text;
}
