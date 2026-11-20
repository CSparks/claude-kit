// question-self-contained.mjs — every question of a questionnaire carries its own plain summary in the `question` field (KIT-T1448).
// The dialog shows the question text and the options only; prose in the message above it is not on screen while it is open.
//
//   SELF_CONTAINED_CHECK                 check id
//   QUESTION_MIN_CHARS                   the shortest question text that passes (after the bracketed tags are cut)
//   SELF_CONTAINED_RULE                  the rule as one line, for a message and `q gates question`
//   questionBody(text)                   -> the text with every [..] tag cut and whitespace collapsed
//   selfContainedProblems(questions)     -> [{ number, header, chars }] one per question whose body is under the minimum
//   selfContainedMessage(problems, footer) -> the block message with the exact form

export const SELF_CONTAINED_CHECK = 'question-self-contained';
export const QUESTION_MIN_CHARS = 400;
export const SELF_CONTAINED_RULE = `every question's own text is a plain summary of at least ${QUESTION_MIN_CHARS} characters (bracketed [..] tags do not count): what is being decided, the facts and numbers, what each option does and costs, your recommendation and why; the dialog shows that text and the options only`;

export const questionBody = (text) => String(text ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

export function selfContainedProblems(questions) {
  return (Array.isArray(questions) ? questions : []).flatMap((q, i) => {
    const chars = questionBody(q?.question).length;
    return chars >= QUESTION_MIN_CHARS ? [] : [{ number: i + 1, header: q?.header || '', chars }];
  });
}

export function selfContainedMessage(problems, footer) {
  return [
    '',
    `BLOCKED: ${problems.length} question(s) are not self-contained (KIT-T1448): the question field must carry the summary.`,
    ...problems.map((p) => `  - question ${p.number}${p.header ? ` ("${p.header}")` : ''}: ${p.chars} characters of text, ${QUESTION_MIN_CHARS} required`),
    '',
    'The maintainer sees the question text and the options, nothing above them. A bare prompt asks him to decide without the facts;',
    'a questionnaire narrows a decision, it does not dumb it down. Put in each question field:',
    '  <the decision in one sentence>. <the facts and numbers that bear on it>. <option A: what it does, what it costs>.',
    '  <option B: what it does, what it costs>. <your recommendation and why>.',
    `Text in [brackets] (tags such as [options-checked: ...]) is cut before counting, so padding with tags does not pass.`,
    '',
    footer,
  ].join('\n');
}
