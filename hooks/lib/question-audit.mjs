// question-audit — the after-the-call check of the summary above a questionnaire (KIT-D153, KIT-D152). Claude Code
// writes a reply to the transcript after the PreToolUse hooks run, so a same-reply summary is unreadable before the
// call; once the call has run it is on disk. The audit judges that a plain summary of reasonable length stands DIRECTLY
// above the call (KIT-T1448): the text and narration between the last tool call or answer and this call, in the same
// reply. Text above an earlier tool call, or above an earlier questionnaire's answer, does not count; a re-ask needs its
// own summary. The question field's own summary is a separate PreToolUse check (question-self-contained-gate.mjs).
//
//   auditQuestionnaire(file, call) -> null when the call cannot be audited yet (no questions, or its entry is not in
//                                     the transcript); else { problems, turn, words } where problems is [] for a sound
//                                     summary and words is the count judged
//   auditMessage(audits)           -> the text sent to the model for the thin summaries in `audits`
//                                     ([{ call, audit }] with a non-empty audit.problems)

import { BRIEF_RULE, briefProblems, wordCount } from './question-brief.mjs';
import { turnText } from './turn-text.mjs';
import { BRIEF_CHECK } from './question-checks.mjs';
import { excludeFooter } from './exclusions.mjs';

const BLOCKS_SHOWN = 10;
const BLOCK_CHARS = 60;

export function auditQuestionnaire(file, call) {
  const questions = call?.input?.questions;
  if (!call?.id || !Array.isArray(questions) || !questions.length) return null;
  const turn = turnText(file, { beforeToolUseId: call.id, adjacent: true });
  if (!turn) return null;
  return { problems: briefProblems(turn.prose), turn, words: wordCount(turn.prose) };
}

const lines = (problems) => problems.map((p) => `  - ${p.part}: ${p.wanted}`);
const blocksRead = (turn) => turn.blocks.slice(-BLOCKS_SHOWN).map((b) => `    [${b.kind}] "${b.text.replace(/\s+/g, ' ').slice(0, BLOCK_CHARS)}"`);

function oneAudit({ call, audit }) {
  const header = call.input.questions.map((q) => q?.header || q?.question).filter(Boolean).join(' / ');
  const read = blocksRead(audit.turn);
  return [
    `Questionnaire "${header}": the summary above it is missing or too short`,
    ...lines(audit.problems),
    `  Counted ${audit.words} words: the text and narration directly above the call (nothing above an earlier tool call or answer counts).${read.length ? ' Blocks read, oldest first:' : ''}`,
    ...read,
  ].join('\n');
}

export function auditMessage(audits) {
  return [
    'Question-brief audit (KIT-D153): the questionnaire already reached the maintainer without a plain summary above it.',
    ...audits.map(oneAudit),
    `Write the summary now, in the same message as the call and directly above it (${BRIEF_RULE}), then re-ask (or tell him what changed) so the answer rests on it. A re-ask needs its own summary.`,
    excludeFooter(BRIEF_CHECK),
  ].join('\n');
}
