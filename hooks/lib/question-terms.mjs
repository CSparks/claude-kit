// question-terms — the terms of art a questionnaire uses that no sentence of the summary above it mentions (RDG-D176, KIT-T1515).
// A term of art is a `code span`, or a word that the project's own decisions and tickets use but only a few of them
// (coined project vocabulary: "datum", "unruled"); plain English never appears in a store at that rarity. An advisory only.
//
//   questionnaireText(questions) -> the header, question, labels and descriptions as one text, tags removed
//   unexplainedTerms(prose, questions, docs) -> [string] terms in the questions and in no sentence of the summary, at most TERMS_SHOWN
//        docs: storeDocs(root) ([] judges code spans only)

import { stemWords, stems } from './stems.mjs';
import { stemRarity } from './stem-rarity.mjs';
import { GROUNDED_DISTINCT_MIN_DF, GROUNDED_DISTINCT_SHARE } from './question-checks.mjs';

export const TERMS_SHOWN = 6;
const TAG = /\[[a-z-]+:[^\]]*\]/gi;
const CODE_SPAN = /`([^`]{2,})`/g;

export const questionnaireText = (questions) => (Array.isArray(questions) ? questions : [])
  .flatMap((q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.flatMap((o) => [o?.label, o?.description]) : [])])
  .filter(Boolean).join('\n').replace(TAG, ' ');

function projectTerms(text, docs) {
  if (!docs.length) return [];
  const sets = docs.map((d) => stems(`${d.title} ${d.text}`));
  const known = new Set(sets.flatMap((s) => [...s]));
  const { isRare } = stemRarity(sets, { share: GROUNDED_DISTINCT_SHARE, minDf: GROUNDED_DISTINCT_MIN_DF });
  return [...stemWords(text)].filter(([stem]) => known.has(stem) && isRare(stem)).map(([stem, word]) => ({ stem, word }));
}

export function unexplainedTerms(prose, questions, docs = []) {
  const text = questionnaireText(questions);
  const summary = String(prose || '');
  const lowered = summary.toLowerCase();
  const spoken = stems(summary);
  const spans = [...text.matchAll(CODE_SPAN)].map((m) => m[1]).filter((span) => !lowered.includes(span.toLowerCase()));
  const words = projectTerms(text.replace(CODE_SPAN, ' '), docs).filter((t) => !spoken.has(t.stem)).map((t) => t.word);
  return [...new Set([...spans, ...words])].slice(0, TERMS_SHOWN);
}
