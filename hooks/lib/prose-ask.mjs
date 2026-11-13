// prose-ask — the sentences of a reply that ask the maintainer for approval, a decision or an action, or say that
// work waits on him, in prose (KIT-T1130, KIT-T1136, KIT-T1151, GG-D088). A request to him goes in an
// AskUserQuestion; the prose-ask-gate Stop hook uses this.
//
//   proseAskMatches(text) -> [{ sentence, phrase }] the matched sentences, oldest first, with the phrase that matched
//   proseAsks(text)       -> the matched sentences only ([] when none)
//
// Text that is not the reply's own voice never counts: fenced and inline code, blockquote lines, and text inside
// double quotes (the maintainer's words, a message quoted back). A sentence in the past tense, or one that negates the
// ask ("he didn't want me to"), describes and needs nothing from him.

const ASK_PHRASES = [
  /\bneeds? (?:your|chris'?s?) (?:say|call|go|go-ahead|approval|decision|input|answer|ok|sign-?off)\b/i,
  /\bneed (?:\w+ )?from (?:you|chris)\b/i,
  /\b(?:waiting|awaiting) (?:on |for )?(?:you|your|chris)\b/i,
  /\b(?:your|chris'?s?) (?:approval|go-ahead|sign-?off|call)\b/i,
  /\bup to (?:you|chris)\b/i,
  /\bfor (?:you|chris) to (?:decide|choose|pick|say|call|sign)\b/i,
  /\bopen for (?:you|chris)\b/i,
  /\bwhich (?:one )?is it\b/i,
  /\b(?:want me to|do you want|should I|shall I|would you like me to)\b/i,
  /\blet me know\b/i,
  /\bonce you (?:sign|approve|say|confirm)\b/i,
  /\bsay the word\b/i,
  /\btell me which\b/i,
  /\bsay so if you (?:want|prefer|would like)\b/i,
];

const DESCRIPTIVE = [
  /\b(?:was|were|had been|been) (?:\w+ )?(?:waiting|awaiting)\b/i,
  /\bwaited (?:on|for)\b/i,
  /\b(?:didn'?t|did not|doesn'?t|does not|don'?t|do not|never|not) (?:\w+ )?(?:want|need) me to\b/i,
  /\b(?:you|chris|he|she|they|the maintainer) (?:said|told|asked|wrote|wanted|decided|waited|let)\b/i,
];

const FENCE = /```[\s\S]*?(?:```|$)/g;
const INLINE_CODE = /`[^`\n]*`/g;
const BLOCKQUOTE = /^[ \t]*>.*$/gm;
const QUOTED = /"[^"\n]*"|“[^”\n]*”/g;
const SENTENCE_BREAK = /(?<=[.!?])\s+|\n+/;

const ownVoice = (text) => text.replace(FENCE, ' ').replace(BLOCKQUOTE, ' ').replace(INLINE_CODE, ' ').replace(QUOTED, ' ');

export function proseAskMatches(text) {
  if (typeof text !== 'string' || !text) return [];
  return ownVoice(text)
    .split(SENTENCE_BREAK)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && !DESCRIPTIVE.some((re) => re.test(s)))
    .flatMap((sentence) => {
      const hit = ASK_PHRASES.map((re) => re.exec(sentence)).find(Boolean);
      return hit ? [{ sentence, phrase: hit[0] }] : [];
    });
}

export const proseAsks = (text) => proseAskMatches(text).map((m) => m.sentence);
