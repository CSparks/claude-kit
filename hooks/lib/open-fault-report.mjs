// open-fault-report — the sentences of a reply that name known faults still open (KIT-T1611, RDG-D194). Open faults are
// standing work: a reply that lists them while no agent works them is a turn that ends idle; the open-fault-dispatch
// Stop hook uses this.
//
//   openFaultReports(text) -> [{ sentence, phrase }] the sentences that say a fault is open, oldest first
//
// A sentence counts when it names an open state of a fault: "known faults", "open bugs", "the freeze is still open",
// "not fixed", "unfixed", "still broken". "still open", "outstanding" and "remains" count beside a fault noun only, so
// "the questionnaire is still open" is no report. The reply is read in its own voice (lib/prose-ask.mjs ownVoice):
// fenced and inline code, blockquotes and double-quoted text never count. A negated fault ("no known faults", "nothing
// open") and talk about the gate itself are no report. Red tests are read by lib/red-test-report.mjs, not here.

import { ownVoice } from './prose-ask.mjs';

const FAULT_NOUN = '(?:faults?|bugs?|defects?|regressions?|issues?|crash(?:es)?|freezes?|hangs?|panics?|glitch(?:es)?|breakages?|problems?)';
const FAULT = new RegExp(`\\b${FAULT_NOUN}\\b`, 'i');

const ALWAYS_OPEN = [
  new RegExp(`\\b(?:known|open|outstanding|unfixed|unresolved|remaining)\\s+(?:\\w+\\s+){0,2}?${FAULT_NOUN}\\b`, 'i'),
  /\bnot (?:yet )?(?:fixed|resolved|repaired)\b|\bunfixed\b|\bunresolved\b|\bstill (?:broken|failing|crash\w*|freez\w*|hang\w*)\b/i,
];
const OPEN_BESIDE_FAULT = /\bstill open\b|\bremains? open\b|\bremain(?:s|ing)?\b|\boutstanding\b|\bopen\b/i;

const NOT_A_REPORT = [
  new RegExp(`\\b(?:no|zero|none|nothing|without|never|0)\\s+(?:\\w+\\s+){0,2}?(?:${FAULT_NOUN}|open|outstanding|remain\\w*)\\b`, 'i'),
  /\b(?:all|every|each)\s+(?:\w+\s+){0,2}?(?:fixed|resolved|closed)\b/i,
  /\bopen[- ]faults?[- ](?:gate|check|hook|rule|report|scanner)\b|\bidle[- ]turn (?:gate|check)\b/i,
];

const KEBAB_ID = /\b[\w]+(?:-[\w]+){2,}\b/g;
const SENTENCE_BREAK = /(?<=[.!?;])\s+|\n+/;
const squash = (s) => s.replace(/\s+/g, ' ').trim();

function phraseOf(sentence) {
  const bare = sentence.replace(KEBAB_ID, ' ');
  if (NOT_A_REPORT.some((re) => re.test(bare))) return null;
  for (const re of ALWAYS_OPEN) {
    const m = re.exec(bare);
    if (m) return m[0];
  }
  if (!FAULT.test(bare)) return null;
  const m = OPEN_BESIDE_FAULT.exec(bare);
  return m ? m[0] : null;
}

export function openFaultReports(text) {
  if (typeof text !== 'string' || !text) return [];
  return ownVoice(text).split(SENTENCE_BREAK).map(squash).filter(Boolean).flatMap((sentence) => {
    const phrase = phraseOf(sentence);
    return phrase ? [{ sentence, phrase }] : [];
  });
}
