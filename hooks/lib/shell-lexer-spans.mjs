// shell-lexer-spans.mjs — where the multi-line spans shell-lexer.mjs reads end: heredoc bodies, PowerShell here-strings,
// and the substitutions inside a double-quoted string whose inner quotes a plain quote pairing would misread.
//
//   heredocDelimiter(text, at) -> { word, dash } | null   the delimiter of the `<<` or `<<-` at `at`, quotes dropped
//   terminates(line, { word, dash }) -> boolean           the line ends that heredoc body (`<<-` strips leading tabs)
//   hasTerminator(text, from, heredoc) -> boolean         a line from `from` on ends the body
//   hereString(text, at) -> { end, body } | null          the here-string opened at `at`: the index after its closing
//                                                         `'@` / `"@` and its text; null when it never closes
//   opensHereString(text, at) -> boolean                  `@'` or `@"` at `at`, nothing but blanks after it on its line
//   substitutionHoldsQuote(text, at, escape) -> boolean   the `$(...)` at `at` holds a double quote outside its heredoc
//                                                         bodies, comments and single quotes, or never closes
//   backtickHoldsQuote(text, at) -> boolean               the backtick span at `at` holds a double quote or never closes

const DELIMITER_END = /[\s;&|<>()]/;
const LEADING_TABS = /^\t+/;
const TRAILING_CR = /\r$/;
const HERE_STRING_OPEN = /^@(['"])[ \t]*\r?\n/;
const COMMENT_LEAD = /[\s;&|(]/;

export function heredocDelimiter(text, at) {
  let i = at + 2;
  const dash = text[i] === '-';
  if (dash) i++;
  while (text[i] === ' ' || text[i] === '\t') i++;
  let word = '';
  let quote = '';
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = ''; else word += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '\\') { word += text[++i] ?? ''; continue; }
    if (DELIMITER_END.test(ch)) break;
    word += ch;
  }
  return word && !quote ? { word, dash } : null;
}

export const terminates = (line, { word, dash }) => {
  const plain = line.replace(TRAILING_CR, '');
  return (dash ? plain.replace(LEADING_TABS, '') : plain) === word;
};

export const hasTerminator = (text, from, heredoc) => text.slice(from).split('\n').some((line) => terminates(line, heredoc));

export const opensHereString = (text, at) => HERE_STRING_OPEN.test(text.slice(at));

export function hereString(text, at) {
  const [opener, quote] = HERE_STRING_OPEN.exec(text.slice(at));
  const closer = `\n${quote}@`;
  const close = text.indexOf(closer, at + opener.length - 1);
  return close < 0 ? null : { end: close + closer.length, body: text.slice(at + opener.length, close) };
}

// The index of the newline ending the last body of `pending`, read from the line after `newline`; -1 when one never ends.
function skipBodies(text, newline, pending) {
  let k = newline + 1;
  for (const heredoc of pending) {
    for (;;) {
      if (k > text.length) return -1;
      const end = text.indexOf('\n', k);
      const stop = end < 0 ? text.length : end;
      const line = text.slice(k, stop);
      k = stop + 1;
      if (terminates(line, heredoc)) break;
    }
  }
  return k - 1;
}

export function substitutionHoldsQuote(text, at, escape) {
  let depth = 0;
  let pending = [];
  for (let j = at + 1; j < text.length; j++) {
    const ch = text[j];
    if (ch === escape) { j++; continue; }
    if (ch === '"') return true;
    if (ch === "'") { j = text.indexOf("'", j + 1); if (j < 0) return true; continue; }
    if (ch === '#' && COMMENT_LEAD.test(text[j - 1])) { j = text.indexOf('\n', j) - 1; if (j < 0) return true; continue; }
    if (text.startsWith('<<', j) && !text.startsWith('<<<', j)) { const heredoc = heredocDelimiter(text, j); if (heredoc) pending.push(heredoc); j++; continue; }
    if (ch === '\n' && pending.length) { j = skipBodies(text, j, pending); pending = []; if (j < 0) return true; continue; }
    if (ch === '(') depth++;
    if (ch === ')' && --depth === 0) return false;
  }
  return true;
}

export function backtickHoldsQuote(text, at) {
  for (let j = at + 1; j < text.length; j++) {
    if (text[j] === '\\') { j++; continue; }
    if (text[j] === '`') return false;
    if (text[j] === '"') return true;
  }
  return true;
}
