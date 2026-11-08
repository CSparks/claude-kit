// question-audit — the after-the-call check of the summary above a questionnaire (KIT-D152, KIT-D129, KIT-D136).
// Claude Code writes a reply to the transcript after the PreToolUse hooks run, so a same-reply summary is unreadable
// before the call; once the call has run it is on disk. The audit judges the prose that came before the call, or
// failing that the questionnaire's own text, with the content standard of lib/question-brief.mjs.
//
//   auditQuestionnaire(file, call) -> null when the call cannot be audited yet (no questions, or its entry is not in
//                                     the transcript); else { problems, note } where problems is [] for a sound brief
//   auditMessage(audits)           -> the text sent to the model for the thin summaries in `audits`
//                                     ([{ call, audit }] with a non-empty audit.problems)

import { BRIEF_STANDARD, briefProblems, wordCount } from './question-brief.mjs';
import { questionnaireText } from './question-text.mjs';
import { turnText } from './turn-text.mjs';
import { BRIEF_CHECK } from './question-checks.mjs';
import { excludeFooter } from './exclusions.mjs';

const BLOCKS_SHOWN = 10;
const BLOCK_CHARS = 60;

const QUESTION_PATH = 'The questionnaire\'s own question text is always read: write the labelled brief there ("Decision:", "Evidence:", "Recommendation:", "Not asked:" each opening a line, evidence as file paths or shas rather than ids, each option\'s consequences in its description).';
const NO_TEXT = 'The reply carrying the call had no text block: private thinking, a narration summary and the questionnaire itself are not a brief.';
const NARRATION = 'The newest block read was narration: the platform stored a summary of the commentary, not the commentary, and summaries drop the labelled lines. Only a text block keeps them.';

// The turn's prose passes, or the questionnaire's own text does; a pass leaves both lists empty.
function verdict(prose, questions) {
  const fromProse = briefProblems(prose, questions);
  if (!fromProse.length) return { prose: [], questions: [] };
  const fromQuestions = briefProblems(questionnaireText(questions), questions);
  return fromQuestions.length ? { prose: fromProse, questions: fromQuestions } : { prose: [], questions: [] };
}

const narrationNewest = (turn) => turn.blocks.at(-1)?.kind === 'narration';
const replyNote = (turn) => [turn.replyHasText || narrationNewest(turn) ? '' : NO_TEXT, narrationNewest(turn) ? NARRATION : ''].filter(Boolean).join(' ');

export function auditQuestionnaire(file, call) {
  const questions = call?.input?.questions;
  if (!call?.id || !Array.isArray(questions) || !questions.length) return null;
  const turn = turnText(file, { beforeToolUseId: call.id });
  if (!turn) return null;
  const result = verdict(turn.prose, questions);
  return { problems: result.prose, readFromQuestions: result.questions, turn, note: result.prose.length ? replyNote(turn) : '' };
}

const lines = (problems) => problems.map((p) => `  - ${p.part}: ${p.wanted}`);
const blocksRead = (turn) => turn.blocks.slice(-BLOCKS_SHOWN).map((b) => `    [${b.kind}] "${b.text.replace(/\s+/g, ' ').slice(0, BLOCK_CHARS)}"`);

function oneAudit({ call, audit }) {
  const header = call.input.questions.map((q) => q?.header || q?.question).filter(Boolean).join(' / ');
  const read = blocksRead(audit.turn);
  return [
    `Questionnaire "${header}": the summary above it lacks`,
    ...lines(audit.problems),
    ...(audit.note ? [`  ${audit.note}`] : []),
    `  Counted ${wordCount(audit.turn.prose)} words of prose from the turn before the call.${read.length ? ' Blocks read, oldest first:' : ''}`,
    ...read,
    `  Read as a brief, the questionnaire's own text lacks ${audit.readFromQuestions.map((p) => p.part).join(', ')}.`,
  ].join('\n');
}

export function auditMessage(audits) {
  return [
    'Question-brief audit (KIT-D152): the questionnaire already reached the maintainer, and its summary was too thin for him to answer from.',
    ...audits.map(oneAudit),
    `Write the missing parts now as one text message, then re-ask (or tell him what changed) so the answer rests on a full summary. ${QUESTION_PATH}`,
    'A brief holds:',
    ...BRIEF_STANDARD.map((s) => `  * ${s}`),
    excludeFooter(BRIEF_CHECK),
  ].join('\n');
}
