// question-brief.mjs — the standard for the summary above a questionnaire (KIT-D153): a plain summary of reasonable
// length came first. Its wording is free; only its presence is judged.
//
//   briefProblems(prose) -> [{ part: 'summary', wanted }] when the prose is shorter than BRIEF_MIN_WORDS; [] otherwise
//   BRIEF_RULE           -> the rule as one line, for a message and `q gates question`
//   BRIEF_MIN_WORDS      -> the shortest summary that passes
//   wordCount(text)      -> the words in a text

export const BRIEF_MIN_WORDS = 40;
export const BRIEF_RULE = `a plain summary first (what is being decided, what each option does and costs, your recommendation), at least ${BRIEF_MIN_WORDS} words, then the questionnaire`;

export const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

export function briefProblems(prose) {
  const words = wordCount(prose);
  return words >= BRIEF_MIN_WORDS ? [] : [{ part: 'summary', wanted: `${BRIEF_RULE}; the text counted before the call has ${words} words` }];
}
