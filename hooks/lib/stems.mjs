// stems.mjs — the distinctive words of a text, cut to a stem, so two texts can be compared by overlap (KIT-T1102).
//
//   stemWords(text) -> Map stem -> the word as written: every word of five letters or more that is not a stopword.
//     A plural is cut to its singular first (settlements/settlement, queries/query); a hyphenated or possessive word
//     counts joined (off-ramp -> offramp) and as its parts, so off-ramps and off-ramp meet whichever way it is written.
//   stems(text)     -> Set of the stems

const TOKEN = /[a-z]+(?:[-'’][a-z]+)*/g;
const SEPARATOR = /[-'’]/g;
const MIN_CHARS = 5;
const STEM_CHARS = 5;
const STOPWORDS = new Set(['about', 'above', 'after', 'again', 'being', 'before', 'could', 'every', 'their', 'there', 'these', 'those', 'which', 'while', 'would', 'where', 'should', 'other', 'still']);

const singular = (word) => word.replace(/ies$/, 'y').replace(/([^s])s$/, '$1');

function addWord(found, written, word) {
  if (word.length < MIN_CHARS || STOPWORDS.has(word)) return;
  const stem = singular(word).slice(0, STEM_CHARS);
  if (!found.has(stem)) found.set(stem, written);
}

export function stemWords(text) {
  const found = new Map();
  for (const token of String(text).toLowerCase().match(TOKEN) || []) {
    addWord(found, token, token.replace(SEPARATOR, ''));
    for (const part of token.split(SEPARATOR)) if (part !== token) addWord(found, part, part);
  }
  return found;
}

export const stems = (text) => new Set(stemWords(text).keys());
