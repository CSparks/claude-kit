// prose-ask — the sentences of a reply that ask the maintainer for approval, a decision or an action, or say that
// work waits on him, in prose, including a hedged hand-back ("if you meant X, tell me", "I can do Y if you want")
// (KIT-T1130, KIT-T1136, KIT-T1151, KIT-T1229, GG-D088). A request to him goes in an
// AskUserQuestion; the prose-ask-gate Stop hook uses this. A closing question that opens with "Which" or offers named
// options is a hard ask too (lib/option-question.mjs, KIT-T1235).
//
//   proseAskMatches(text) -> [{ sentence, phrase, hard }] the matched sentences, oldest first, with the phrase that matched
//   proseAsks(text)       -> the matched sentences only ([] when none)
//   hasHardAsk(text)      -> true when a sentence says work waits on him (waiting on you, your call, a "Your calls" lead-in,
//                            yours to decide, pending your decision, up to you, which one is it ...)
//
// Text that is not the reply's own voice never counts: fenced and inline code, blockquote lines, and text inside
// double quotes (the maintainer's words, a message quoted back). A sentence in the past tense, or one that negates the
// ask ("he didn't want me to"), describes and needs nothing from him. So does a wait phrase a negation governs in its
// own clause ("Nothing else needs your input", KIT-T1273).

import { optionQuestionMatch } from './option-question.mjs';

const OWNER = "(?:your|chris'?s?|his|the maintainer'?s)";

// HARD phrases say work waits on him; they block even when his newest message was a question (GG-D093), and a
// reply carrying one lets the questionnaire gate pass a questionnaire.
const HARD_PHRASES = [
  /\b(?:waiting|awaiting) (?:on |for )?(?:you|your|chris)\b/i,
  new RegExp(`\\b${OWNER} call\\b`, 'i'),
  new RegExp(`^[\\s#>*_\\-•\\d.)]*${OWNER} calls?\\b\\s*(?:[:,—–-]|$)`, 'i'),
  /\byours to (?:decide|choose|pick|call|say|sign)\b/i,
  /\bpending (?:your|chris'?s?) (?:decisions?|calls?|input|approval|answer|go-ahead|sign-?off|say)\b/i,
  /\bup to (?:you|chris)\b/i,
  /\bfor (?:you|chris) to (?:decide|choose|pick|say|call|sign)\b/i,
  /\bopen for (?:you|chris)\b/i,
  /\bwhich (?:one )?is it\b/i,
];

// A hedged hand-back: "if you meant X, just say so", "I can do Y if you want" — the ask in a conditional.
function conditionalOffers() {
  const wish = "(?:meant|want|wish|prefer|would (?:like|rather|prefer)|'d (?:like|rather|prefer)|need)";
  const handBack = '(?:just |please |simply )?(?:say|reply|respond|ping|message|flag|shout|holler|send)\\b';
  return [
    new RegExp(`\\bif you ${wish}\\b[^.?!\\n]*?[,;]?\\s*${handBack}`, 'i'),
    new RegExp(`\\b(?:just|simply) ${handBack}`, 'i'),
    new RegExp(`\\bI (?:can|could|will|would|'ll)\\b[^.?!\\n]*\\bif you (?:want|wish|like|prefer|'d like)\\b`, 'i'),
    new RegExp(`\\bif you ${wish}\\b[^.?!\\n]*?,\\s*I (?:can|could|will|would|'ll)\\b`, 'i'),
  ];
}

const SOFT_PHRASES = [
  /\bneeds? (?:your|chris'?s?) (?:say|call|go|go-ahead|approval|decision|input|answer|ok|sign-?off)\b/i,
  /\bneed (?:\w+ )?from (?:you|chris)\b/i,
  /\b(?:your|chris'?s?) (?:approval|go-ahead|sign-?off)\b/i,
  /\b(?:want me to|do you want|should I|shall I|would you like me to)\b/i,
  /\blet me know\b/i,
  /\bonce you (?:sign|approve|say|confirm)\b/i,
  /\bsay the word\b/i,
  /\btell me\b/i,
  /\bsay so if you (?:want|prefer|would like)\b/i,
  ...conditionalOffers(),
];

const DESCRIPTIVE = [
  /\b(?:was|were|had been|been) (?:\w+ )?(?:waiting|awaiting)\b/i,
  /\bwaited (?:on|for)\b/i,
  /\b(?:didn'?t|did not|doesn'?t|does not|don'?t|do not|never|not) (?:\w+ )?(?:want|need) me to\b/i,
  /\b(?:you|chris|he|she|they|the maintainer) (?:said|told|asked|wrote|wanted|decided|waited|let)\b/i,
];

// A wait phrase is not an ask when a negation governs it in its own clause: a quantifier-negation anywhere before it
// ("Nothing else needs your input", "No decision needs your input", "Nothing is waiting on you") or a verb-negation
// right before it ("does not need your input", "no longer waiting on you").
const CLAUSE_BREAK = /[,;:—–]|\s-\s|\b(?:but|however|yet|although|though)\b/gi;
const QUANTIFIER_NEGATION = /\b(?:nothing|nobody|no one|none|neither|nor|no)\b/i;
const VERB_NEGATION = /(?:\b(?:not|never|no longer)|n't)\s+(?:\w+\s+){0,2}$/i;

function negatedBefore(sentence, index) {
  const breaks = [...sentence.slice(0, index).matchAll(CLAUSE_BREAK)];
  const last = breaks[breaks.length - 1];
  const clauseStart = last ? last.index + last[0].length : 0;
  const prefix = sentence.slice(clauseStart, index);
  return QUANTIFIER_NEGATION.test(prefix) || VERB_NEGATION.test(prefix);
}

const FENCE =/```[\s\S]*?(?:```|$)/g;
const INLINE_CODE = /`[^`\n]*`/g;
const BLOCKQUOTE = /^[ \t]*>.*$/gm;
const QUOTED = /"[^"\n]*"|“[^”\n]*”/g;
const SENTENCE_BREAK = /(?<=[.!?])\s+|\n+/;

export const ownVoice = (text) => text.replace(FENCE, ' ').replace(BLOCKQUOTE, ' ').replace(INLINE_CODE, ' ').replace(QUOTED, ' ').replace(/\.{2,}/g, '…');
const descriptive = (sentence) => DESCRIPTIVE.some((re) => re.test(sentence));

// A rollup heading that names what waits on him ("Waiting on you:", "**Needs your decision:**", "Decisions for you") with at
// least one list item under it is the same ask as the sentence: each item is a decision to put in a questionnaire (KIT-T1312).
const HEADING_WORDS = [
  'waiting (?:on|for) (?:you|chris)', 'awaiting (?:your \\w+|you)', 'needs? (?:your|chris\'?s?) \\w+(?:[- ]\\w+)?', 'needs? (?:a )?(?:decision|input|answer)s? from (?:you|chris)',
  'open for (?:you|chris)', 'decisions?(?: needed)?(?: for| from) (?:you|chris)', 'questions? for (?:you|chris)', 'for (?:you|chris) to (?:decide|choose|pick|say|sign)',
  '(?:your|chris\'?s?) (?:decisions?|call|calls|input|approval)', 'actions? (?:needed )?from (?:you|chris)', 'blocked on (?:you|chris)', 'pending (?:your|chris\'?s?) \\w+',
].join('|');
const HEADING = new RegExp(`^(?:#{1,6}\\s*)?(?:[*_]{1,2}\\s*)?(?:${HEADING_WORDS})\\s*:?\\s*(?:[*_]{1,2})?\\s*:?\\s*$`, 'i');
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+\S/;

function headingAsks(own) {
  const lines = own.split('\n');
  return lines.flatMap((line, i) => {
    const heading = HEADING.exec(line.trim());
    if (!heading || descriptive(line)) return [];
    const item = lines.slice(i + 1).find((l) => l.trim());
    if (!item || !LIST_ITEM.test(item)) return [];
    const phrase = line.trim().replace(/^#+\s*|[*_:]/g, '').trim();
    return [{ sentence: `${phrase}: ${item.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim()}`, phrase, hard: true }];
  });
}

export function proseAskMatches(text) {
  if (typeof text !== 'string' || !text) return [];
  const own = ownVoice(text);
  const segments = own.split(SENTENCE_BREAK).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const headings = headingAsks(own);
  const sentences = segments.flatMap((sentence) => {
    if (descriptive(sentence)) return [];
    const live = (re) => {
      const found = re.exec(sentence);
      return found && !negatedBefore(sentence, found.index) ? found : null;
    };
    const hard = HARD_PHRASES.map(live).find(Boolean);
    const hit = hard || SOFT_PHRASES.map(live).find(Boolean);
    return hit ? [{ sentence, phrase: hit[0], hard: Boolean(hard) }] : [];
  });
  const headed = (m) => headings.some((h) => m.sentence.replace(/^[^a-z]+/i, '').toLowerCase().startsWith(h.phrase.toLowerCase()));
  const asks = [...sentences.filter((m) => !headed(m)), ...headings];
  const closing = optionQuestionMatch(own, segments);
  if (!closing || descriptive(closing.sentence)) return asks;
  const rest = asks.filter((m) => m.sentence !== closing.sentence);
  return [...rest, { ...closing, hard: true }];
}

export const hasHardAsk = (text) => proseAskMatches(text).some((m) => m.hard);

export const proseAsks = (text) => proseAskMatches(text).map((m) => m.sentence);
