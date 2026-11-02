// q-grep-pattern.mjs — a `q code --regex` pattern typed in grep's dialect, read the way the agent meant it.
//
//   grepPattern(text) -> text a JS RegExp can compile, or the input unchanged when no reading compiles
//
// Two grep habits differ from JS: BRE writes alternation as `\|` (JS: a literal pipe), and a bare
// `(` or `)` is a literal (JS: a group, so `getNumBuses( *kEvent` does not compile).

/** In --regex mode a pattern whose only alternation is grep's `\|` means alternation; a pattern with a bare `|` is left alone. */
export function breAlternation(text) {
  let bare = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { if (text[i + 1] === '|') escaped = true; i++; } else if (text[i] === '|') bare = true;
  }
  return escaped && !bare ? text.replace(/\\\|/g, '|') : text;
}

const compiles = (src) => {
  try { new RegExp(src); return true; } catch { return false; }
};

// Escape every unescaped paren: the BRE reading of a pattern whose groups do not balance.
const literalParens = (text) => text.replace(/\\[\s\S]|[()]/g, (m) => (m.length === 1 ? `\\${m}` : m));

export function grepPattern(text) {
  const alternated = breAlternation(text);
  if (compiles(alternated)) return alternated;
  const literal = literalParens(alternated);
  return compiles(literal) ? literal : alternated;
}
