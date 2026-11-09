// question-text — a questionnaire's own question fields as one summary candidate (KIT-D153). Claude Code stores some
// commentary as a platform-written narration summary that can be lossy; the questionnaire arrives in the hook payload
// whole, so a summary written in the question field is always readable. Option labels and descriptions are not
// counted: they are the options, not the summary above them.
//
//   questionText(questions) -> each question's header and text, questions separated by blank lines

const questionBlock = (q) => [q?.header, q?.question].filter(Boolean).join('\n');

export const questionText = (questions) => (Array.isArray(questions) ? questions : []).map(questionBlock).filter(Boolean).join('\n\n');
