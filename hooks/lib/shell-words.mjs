// shell-words.mjs — the plain words of a shell text.
//
//   wordsIn(text) -> [{ w, at }]   every run of characters outside whitespace, quotes, backticks, operators, parentheses and
//                                  angle brackets, with its start index in `text`

const WORD = /[^\s'"`;|&()<>]+/g;

export const wordsIn = (text) => [...text.matchAll(WORD)].map((m) => ({ w: m[0], at: m.index }));
