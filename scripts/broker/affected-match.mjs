// affected-match.mjs — which integration-test sources "name" a changed src module (affected.mjs).
//
//   word   (default): the module's bare name appears as a word anywhere in the test source.
//   module: the module is reached by path — `parent::mod`, `parent::{…, mod, …}` or `mod::…`
//           (`parent` is the enclosing module, or the crate name at the crate root). A word in a
//           comment, a string or a local variable no longer pulls the test; a test that reaches the
//           module only through a re-export is missed (the suite cadence still runs it).
//
// `namingMatcher(mode, { crate, parent })` → (text, word) => boolean.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_EDGE = '(?<![\\w])';
const WORD_END = '(?![\\w])';

const word = (w) => new RegExp(`${WORD_EDGE}${escape(w)}${WORD_END}`);

function modulePath(w, parent) {
  const m = escape(w);
  const p = escape(parent);
  return new RegExp(`${WORD_EDGE}${m}::|${WORD_EDGE}${p}::${m}${WORD_END}|${WORD_EDGE}${p}::\\{[^}]*${WORD_EDGE}${m}${WORD_END}`);
}

export function namingMatcher(mode, { crate, parent }) {
  if (mode !== 'module') return (text, w) => word(w).test(text);
  const owner = parent || String(crate).replace(/-/g, '_');
  return (text, w) => modulePath(w, owner).test(text);
}
