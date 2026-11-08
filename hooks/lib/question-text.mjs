// question-text — a questionnaire's own words as one brief candidate (KIT-T906). Claude Code stores some commentary
// as a platform-written narration summary that drops a brief's labelled lines; the questionnaire arrives in the
// hook payload whole, so a brief written in the question field is always readable.
//
//   questionnaireText(questions) -> per question: its header and text, a blank line, then each option as
//                                   "<label> <description>" (the "(Recommended)" marker is cut so the label alone
//                                   never satisfies the recommendation check); questions separated by blank lines

import { RECOMMENDED_MARKER } from './question-checks.mjs';

const cut = (label) => String(label || '').replace(RECOMMENDED_MARKER, '').trim();
const optionLine = (o) => `${cut(o?.label)} ${o?.description || ''}`.trim();
const questionBlock = (q) => [[q?.header, q?.question].filter(Boolean).join('\n'), (Array.isArray(q?.options) ? q.options : []).map(optionLine).join('\n')].filter(Boolean).join('\n\n');

export const questionnaireText = (questions) => (Array.isArray(questions) ? questions : []).map(questionBlock).filter(Boolean).join('\n\n');
