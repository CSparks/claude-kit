// question-brief.mjs — the standard for the summary above a questionnaire (KIT-D153): a plain summary of reasonable
// length came first. Its wording is free; only its presence is judged.
//
//   briefProblems(prose, { narrationOnly }) -> [{ part: 'summary', wanted }] when the prose is shorter than BRIEF_MIN_WORDS
//                        (BRIEF_MIN_NARRATION_WORDS when the transcript holds only the shortened commentary copy); [] otherwise
//   BRIEF_RULE           -> the rule as one line, for a message and `q gates question`
//   BRIEF_MIN_WORDS      -> the shortest summary that passes
//   wordCount(text)      -> the words in a text

export const BRIEF_MIN_WORDS = 40;
// Commentary written beside a tool call is stored as a shortened copy (a 170-word summary read as 37 words), so a summary
// the transcript holds only as that copy is judged at half the bar (KIT-T1465).
export const BRIEF_MIN_NARRATION_WORDS = 20;
export const BRIEF_RULE = `a plain summary first, in the same message as the call and directly above it (what is being decided, what each option does and costs, your recommendation), at least ${BRIEF_MIN_WORDS} words, then the questionnaire, whose questions stay short and never carry the summary; a re-ask needs its own`;

export const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

export function briefProblems(prose, { narrationOnly = false } = {}) {
  const words = wordCount(prose);
  const min = narrationOnly ? BRIEF_MIN_NARRATION_WORDS : BRIEF_MIN_WORDS;
  return words >= min ? [] : [{ part: 'summary', wanted: `${BRIEF_RULE}; the text counted before the call has ${words} words${narrationOnly ? ` (a shortened commentary copy, judged at ${min})` : ''}` }];
}
