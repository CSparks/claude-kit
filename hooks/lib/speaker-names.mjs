// speaker-names — a questionnaire names the two parties "Chris" and "Claude", never you, your, yours, I, my, me, we, our or
// us (RDG-D177, KIT-T1624). Scoped to a project whose store holds that decision; ordinary replies and the summary above
// the call are not judged.
//
//   speakerRuleHeld(root)  -> true when `<root>/.ai/decisions/` holds the in-force decision, found by its id or its title
//   speakerHits(text)      -> [{ word, sentence }] each pronoun in the text's own voice, with the sentence it sits in
//
// Quoted words (double or curly quotes, blockquote lines), code (fences, `inline`) and gate tags ([re-ask: ...]) are masked
// to spaces of the same length before the scan, so a sentence is cut from the original text at the same offsets and a full
// stop inside a quote never splits a sentence. `I` is matched in capitals only; an all-caps word (US, ME) and a word glued
// to a slash or hyphen (I/O, us-east-1) is not a pronoun.

import { readDecisions } from '../../scripts/decision-governs.mjs';

export const SPEAKER_RULE_ID = 'RDG-D177';
const SPEAKER_RULE_TITLE = /\bname the speakers\b/i;

const MASKED = [
  /```[\s\S]*?(?:```|$)/g,
  /`[^`\n]*`/g,
  /^[ \t]*>.*$/gm,
  /"[^"\n]*"|“[^”\n]*”/g,
  /\[[a-z][a-z-]*:[^\]\n]*\]/g,
];
const PRONOUN = /(?<![\w/-])(?:I|[Yy]ou|[Yy]our|[Yy]ours|[Mm]y|[Mm]e|[Ww]e|[Oo]ur|[Uu]s)(?![\w/]|-\w)/g;
const SENTENCE_END = /[.!?](?=\s)|\n/g;

export const speakerRuleHeld = (root) => readDecisions(root).some((d) => d.id === SPEAKER_RULE_ID || SPEAKER_RULE_TITLE.test(d.title || ''));

const mask = (text) => MASKED.reduce((t, re) => t.replace(re, (m) => m.replace(/[^\n]/g, ' ')), text);

function sentenceAt(text, masked, index) {
  let start = 0;
  let end = text.length;
  for (const m of masked.matchAll(SENTENCE_END)) {
    const after = m.index + m[0].length;
    if (after <= index) start = after;
    else { end = after; break; }
  }
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function speakerHits(text) {
  if (typeof text !== 'string' || !text) return [];
  const masked = mask(text);
  return [...masked.matchAll(PRONOUN)].map((m) => ({ word: m[0], sentence: sentenceAt(text, masked, m.index) }));
}
