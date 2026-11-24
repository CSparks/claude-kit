// question-bundle — an option label that bundles several decisions ("Accept all four", "All of the above") and the parts it
// hides (RDG-D176, KIT-T1515). The maintainer cannot answer a bundle whose parts nobody named.
//
//   bundleLabel(label)              -> { count, ofSiblings } | null   count: the number the label states (0 when none); ofSiblings:
//                                      the label stands for the other options ("all of the above"), not for a list in its description
//   bundledOptions(questions)       -> [{ header, label, count, parts }] every bundling option, parts read from the questionnaire alone
//   bundleShortfalls(bundles)       -> [{ ...bundle, found }] bundles whose parts cannot be told apart (fewer than two, or fewer than the count)
//   unnamedParts(bundle, prose)     -> the parts no sentence of the summary names
//   hasBundleChecked(text)          -> true when the text carries [bundle-checked: <why>]

import { stemWords } from './stems.mjs';
import { RECOMMENDED_MARKER } from './question-checks.mjs';
import { TOKENS } from './gate-tokens.mjs';

const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const LEADING_VERBS = 'accept|approve|take|choose|pick|select|apply|confirm|adopt|do|yes to|go with';
const BUNDLE = new RegExp(`^(?:(?:${LEADING_VERBS})\\s+)?all(?:\\s+(?:of\\s+(above|the\\s+above|them|these|those)|the\\s+(above)|(${Object.keys(NUMBER_WORDS).join('|')}|\\d+))\\b|\\s*$|\\s*[(:,;-])`, 'i');
const MIN_PARTS = 2;
const MIN_WORD = 3;
const SENTENCE = /(?<=[.!?])\s+|\n+/;
const LABEL_NOISE = new RegExp(`^\\s*(?:${RECOMMENDED_MARKER.replace(/[()]/g, '\\$&')}\\s*)?|\\s*${RECOMMENDED_MARKER.replace(/[()]/g, '\\$&')}\\s*$`, 'gi');

const cleanLabel = (label) => String(label || '').replace(LABEL_NOISE, '').trim();
const cleanPart = (text) => text.trim().replace(/^and\s+/i, '').replace(/[.\s]+$/, '');
const split = (text, separator) => String(text || '').split(separator).map(cleanPart).filter(Boolean);

export function bundleLabel(label) {
  const hit = BUNDLE.exec(cleanLabel(label));
  if (!hit) return null;
  const counted = hit[3];
  return { count: counted ? (NUMBER_WORDS[counted.toLowerCase()] || Number(counted)) : 0, ofSiblings: Boolean(hit[1] || hit[2]) };
}

function describedParts(description) {
  const byMark = split(description, ';');
  return byMark.length >= MIN_PARTS ? byMark : [byMark, split(description, /,|\band\b/i)].sort((a, b) => b.length - a.length)[0];
}

export function bundledOptions(questions) {
  const found = [];
  for (const q of Array.isArray(questions) ? questions : []) {
    const options = Array.isArray(q?.options) ? q.options : [];
    for (const option of options) {
      const bundle = bundleLabel(option?.label);
      if (!bundle) continue;
      const parts = bundle.ofSiblings
        ? options.filter((o) => o !== option && !bundleLabel(o?.label)).map((o) => cleanLabel(o?.label)).filter(Boolean)
        : describedParts(option?.description);
      found.push({ header: q?.header || q?.question || '', label: cleanLabel(option?.label), ...bundle, parts });
    }
  }
  return found;
}

export const bundleShortfalls = (bundles) => bundles
  .filter((b) => b.parts.length < Math.max(MIN_PARTS, b.count))
  .map((b) => ({ ...b, found: b.parts.length }));

const wordsOf = (text) => (String(text).toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length >= MIN_WORD);

function partNamed(part, sentences) {
  const stems = [...stemWords(part).keys()];
  if (stems.length) {
    const need = Math.ceil(stems.length / 2);
    return sentences.some((s) => { const have = stemWords(s); return stems.filter((x) => have.has(x)).length >= need; });
  }
  const words = wordsOf(part);
  return words.length > 0 && sentences.some((s) => { const have = new Set(wordsOf(s)); return words.every((w) => have.has(w)); });
}

export function unnamedParts(bundle, prose) {
  const sentences = String(prose || '').split(SENTENCE).filter(Boolean);
  return bundle.parts.filter((p) => !partNamed(p, sentences));
}

export const hasBundleChecked = (text) => TOKENS.bundleChecked.pattern.test(String(text || ''));
