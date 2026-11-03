// stems.mjs — the distinctive words of a text, cut to a stem, so two texts can be compared by overlap.
//
//   stems(text)  -> Set of the first STEM_CHARS letters of every word of five letters or more that is not a stopword

const WORD = /[a-z]{5,}/g;
const STEM_CHARS = 5;
const STOPWORDS = new Set(['about', 'above', 'after', 'again', 'being', 'before', 'could', 'every', 'their', 'there', 'these', 'those', 'which', 'while', 'would', 'where', 'should', 'other', 'still']);

export const stems = (text) => new Set((String(text).toLowerCase().match(WORD) || []).filter((w) => !STOPWORDS.has(w)).map((w) => w.slice(0, STEM_CHARS)));
