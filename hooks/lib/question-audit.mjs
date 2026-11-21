// question-audit — the after-the-call check of the summary above a questionnaire (KIT-D153, KIT-D152). Claude Code
// writes a reply to the transcript after the PreToolUse hooks run, so a same-reply summary is unreadable before the
// call; once the call has run it is on disk. The audit judges that a plain summary of reasonable length stands DIRECTLY
// above the call (KIT-T1448): the text and narration between the last tool call or answer and this call, in the same
// reply. Text above an earlier tool call, or above an earlier questionnaire's answer, does not count; a re-ask needs its
// own summary, and so does a resend after a hook refused the call (KIT-T1465). The question fields never count and never carry the summary (RDG-D145).
//
//   auditQuestionnaire(file, call) -> null when the call cannot be audited yet (no questions, or its entry is not in
//                                     the transcript); else { problems, turn, words } where problems is [] for a sound
//                                     summary and words is the count judged
//   auditMessage(audits)           -> the text sent to the model for the thin summaries in `audits`
//                                     ([{ call, audit }] with a non-empty audit.problems)

import { BRIEF_MIN_NARRATION_WORDS, BRIEF_MIN_WORDS, BRIEF_RULE, briefProblems, wordCount } from './question-brief.mjs';
import { turnText } from './turn-text.mjs';
import { BRIEF_CHECK } from './question-checks.mjs';
import { excludeFooter } from './exclusions.mjs';

const BLOCK_CHARS = 400;

const narrationOnly = (turn) => turn.blocks.length > 0 && turn.blocks.every((b) => b.kind === 'narration');

export function auditQuestionnaire(file, call) {
  const questions = call?.input?.questions;
  if (!call?.id || !Array.isArray(questions) || !questions.length) return null;
  const turn = turnText(file, { beforeToolUseId: call.id, adjacent: true });
  if (!turn) return null;
  return { problems: briefProblems(turn.prose, { narrationOnly: narrationOnly(turn) }), turn, words: wordCount(turn.prose) };
}

const lines = (problems) => problems.map((p) => `  - ${p.part}: ${p.wanted}`);
const blocksRead = (turn) => turn.blocks.map((b) => `    [${b.kind}, ${wordCount(b.text)} words] "${b.text.replace(/\s+/g, ' ').slice(0, BLOCK_CHARS)}"`);
const NARRATION_NOTE = `  Only narration blocks were recorded above the call: Claude Code stores commentary written beside a tool call as a shortened platform copy (a 170-word summary was recorded as 37 words), so the transcript cannot show what you wrote. Such a copy is judged at ${BRIEF_MIN_NARRATION_WORDS} words instead of ${BRIEF_MIN_WORDS}; to be counted whole, write the summary as reply text (not commentary) directly above the call, and repeat it in full on a re-ask.`;

function oneAudit({ call, audit }) {
  const header = call.input.questions.map((q) => q?.header || q?.question).filter(Boolean).join(' / ');
  const read = blocksRead(audit.turn);
  const count = `${audit.turn.blocks.length} block${audit.turn.blocks.length === 1 ? '' : 's'}`;
  return [
    `Questionnaire "${header}": the summary above it is missing or too short`,
    ...lines(audit.problems),
    `  Counted ${audit.words} words in ${count}: every text and narration block directly above the call, back to the previous tool call or answer (nothing above that counts).${read.length ? ' Blocks counted, oldest first:' : ''}`,
    ...read,
    ...(narrationOnly(audit.turn) ? [NARRATION_NOTE] : []),
  ].join('\n');
}

export function auditMessage(audits) {
  return [
    'Question-brief audit (KIT-D153): the questionnaire already reached the maintainer without a plain summary above it.',
    ...audits.map(oneAudit),
    `Write the summary now, in the same message as the call and directly above it (${BRIEF_RULE}), then re-ask (or tell him what changed) so the answer rests on it. A re-ask, and a resend after a block, needs its own whole summary (KIT-T1465).`,
    excludeFooter(BRIEF_CHECK),
  ].join('\n');
}
