// prose-ask — the sentences of a reply that ask the maintainer for approval, a decision or an action in prose
// (KIT-T1130, KIT-T1136). A request to him goes in an AskUserQuestion; the prose-ask-gate Stop hook uses this.
//
//   proseAsks(text) -> the matched sentences, oldest first ([] when none)
//
// Text that is not the reply's own voice never counts: fenced and inline code, blockquote lines, and text inside
// double quotes (the maintainer's words, a message quoted back).

const ASK_PHRASES = [
  /\bneeds? your (?:say|call|go|go-ahead|approval|decision|input|answer|ok|sign-?off)\b/i,
  /\bneed (?:\w+ )?from you\b/i,
  /\bwaiting (?:on|for) (?:you|your)\b/i,
  /\byour (?:approval|go-ahead|sign-?off|call)\b/i,
  /\b(?:want me to|should I|shall I|would you like me to)\b/i,
  /\blet me know (?:if|whether) you(?:'d| would)? (?:want|like|prefer|approve|agree)\b/i,
  /\bsay so if you (?:want|prefer|would like)\b/i,
];

const FENCE = /```[\s\S]*?(?:```|$)/g;
const INLINE_CODE = /`[^`\n]*`/g;
const BLOCKQUOTE = /^[ \t]*>.*$/gm;
const QUOTED = /"[^"\n]*"|“[^”\n]*”/g;
const SENTENCE_BREAK = /(?<=[.!?])\s+|\n+/;

const ownVoice = (text) => text.replace(FENCE, ' ').replace(BLOCKQUOTE, ' ').replace(INLINE_CODE, ' ').replace(QUOTED, ' ');

export function proseAsks(text) {
  if (typeof text !== 'string' || !text) return [];
  return ownVoice(text)
    .split(SENTENCE_BREAK)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && ASK_PHRASES.some((re) => re.test(s)));
}
