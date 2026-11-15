// option-question — a closing question to the maintainer that offers named options, or opens with "Which" /
// "What do you want", written in prose instead of an AskUserQuestion (KIT-T1235, KIT-T1230, KIT-D168).
// prose-ask.mjs uses it on the reply's own voice (code, blockquotes and quotes already removed).
//
//   optionQuestionMatch(ownText, segments) -> { sentence, phrase } | null
//
// `segments` are the reply's sentences/lines, oldest first. The closing question is the last segment ending in "?"
// among the final CLOSING_WINDOW segments (a UAT line may follow it). It matches when it opens with a choice lead
// ("Which ...", "What do you want ..."), or the reply enumerates options (A/B/C labels, "Option A/Option B", numbered or
// bold-labelled items) or states a pick ("I'd pick", "my recommendation", "(Recommended)").

const CLOSING_WINDOW = 3;
const MIN_OPTIONS = 2;

const QUESTION_END = /\?[\s*_)\]"']*$/;
const CHOICE_LEAD = /^[\s*_(["']*(?:so,? |and )?(which|what do you (?:want|prefer|think|picture|have in mind)|what would you (?:like|prefer|want)|how do you want)\b/i;
const CHOICE_WORD = /\b(?:which|or|prefer|pick|choose|closest|option|approach|direction|go with|better)\b/i;
const PICK = /\bI(?:'d| would| will)? (?:pick|recommend|suggest|go with|choose|lean)\b|\bmy (?:recommendation|pick)\b|\(Recommended\)/i;

const LETTER_LABEL = /^\s*(?:[-*•]\s+)?(?:\*\*|__)?(?:option\s+)?\(?([A-Ea-e])[.):](?=\s|\*|_)/;
const OPTION_WORD = /\boption ([A-Ea-e1-5])\b/gi;
const NUMBERED = /^\s*\d{1,2}[.)]\s/;
const BOLD_ITEM = /^\s*[-*•]\s+(?:\*\*|__)[^*_\n]+(?:\*\*|__)/;

const lines = (text) => text.split('\n');
const distinct = (items) => new Set(items.map((s) => s.toLowerCase()));

function lettered(text) {
  const labels = lines(text).map((l) => LETTER_LABEL.exec(l)?.[1]).filter(Boolean);
  const named = [...text.matchAll(OPTION_WORD)].map((m) => m[1]);
  return (distinct(labels).size >= MIN_OPTIONS && distinct(labels).has('a')) || distinct(named).size >= MIN_OPTIONS;
}

const ordinal = (text) => [NUMBERED, BOLD_ITEM].some((re) => lines(text).filter((l) => re.test(l)).length >= MIN_OPTIONS);

export function optionQuestionMatch(ownText, segments) {
  const tail = segments.slice(-CLOSING_WINDOW);
  const sentence = [...tail].reverse().find((s) => QUESTION_END.test(s));
  if (!sentence) return null;
  const lead = CHOICE_LEAD.exec(sentence);
  if (lead) return { sentence, phrase: lead[1] };
  const pick = PICK.exec(ownText);
  if (pick) return { sentence, phrase: pick[0] };
  if (lettered(ownText) || (ordinal(ownText) && CHOICE_WORD.test(sentence))) return { sentence, phrase: 'a closing question offering options' };
  return null;
}
