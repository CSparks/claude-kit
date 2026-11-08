#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — the questionnaire needs a sufficient brief and a topic that is
// ready to be asked (KIT-D129, KIT-T846). exit 2 = block, 0 = allow.
//
// brief   (check id question-brief)  the assistant's prose this turn, or else the questionnaire's own question text,
//                                    meets the content standard (lib/question-brief.mjs, lib/question-text.mjs; KIT-T906)
// ready   (check id question-ready)  the newest maintainer message is not a question or floated idea, and no question
//                                    restates what he already said (lib/question-ready.mjs)
//
// The prose and the maintainer's message come from the transcript, read once it holds this call's own tool_use entry
// (lib/turn-text.mjs). A payload without a readable transcript is allowed.
// Fails open on any error.

import { payload, gitRoot, pathExcluded, excludeFooter } from './lib.mjs';
import { turnTextForCall } from './lib/turn-text.mjs';
import { BRIEF_STANDARD, briefProblems, wordCount } from './lib/question-brief.mjs';
import { questionnaireText } from './lib/question-text.mjs';
import { readinessProblems } from './lib/question-ready.mjs';
import { BRIEF_CHECK, READY_CHECK } from './lib/question-checks.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);

const enabled = (root, check) => !root || !pathExcluded(root, check, root);
// The turn's prose passes, or the questionnaire's own text does; a pass leaves both lists empty.
function briefVerdict(prose, questions) {
  const fromProse = briefProblems(prose, questions);
  if (!fromProse.length) return { prose: [], questions: [] };
  const fromQuestions = briefProblems(questionnaireText(questions), questions);
  return fromQuestions.length ? { prose: fromProse, questions: fromQuestions } : { prose: [], questions: [] };
}

const lines = (problems) => problems.map((p) => `  - ${p.part}: ${p.wanted}`);

const QUESTION_PATH = 'The questionnaire\'s own question text is always read: write the labelled brief there ("Decision:", "Evidence:", "Recommendation:", "Not asked:" each opening a line, evidence as file paths or shas rather than ids, each option\'s consequences in its description).';
const NO_TEXT = `The reply carrying this call has no text block: private thinking, a narration summary and the questionnaire itself are not a brief. (Counted instead: prose from earlier replies this turn.) ${QUESTION_PATH}`;
const NARRATION = `The newest block is narration: the platform stored a summary of your commentary, not the commentary, and summaries drop the labelled lines. Only a text block keeps them, and a session cannot force one to be stored. ${QUESTION_PATH}`;
const BLOCKS_SHOWN = 10;
const BLOCK_CHARS = 60;
const UNFLUSHED = 'Claude Code writes a reply to the transcript only after hooks have run, so text sent in the same reply as this call cannot be read; only earlier replies this turn were counted. A brief sent in this reply is read once the identical call is resent. A brief sent in an earlier reply was read in full: the parts below are what it lacks, and resending changes nothing until a text message adds them.';
const LEAD_CHARS = 80;

const counted = (turn) => {
  const lead = turn.newestProse.replace(/\s+/g, ' ').slice(0, LEAD_CHARS);
  return lead ? `Counted: ${wordCount(turn.prose)} words of text from this turn; the newest block begins "${lead}".` : 'Counted: no text from this turn.';
};
const narrationNewest = (turn) => turn.blocks.at(-1)?.kind === 'narration';
const replyNote = (turn) => {
  const reply = turn.replyUnflushed ? UNFLUSHED : turn.replyHasText ? '' : narrationNewest(turn) ? '' : NO_TEXT;
  return [reply, narrationNewest(turn) ? NARRATION : '', counted(turn)].filter(Boolean).join(' ');
};
const blocksRead = (turn) => turn.blocks.slice(-BLOCKS_SHOWN).map((b) => `    [${b.kind}] "${b.text.replace(/\s+/g, ' ').slice(0, BLOCK_CHARS)}"`);

function blockMessage(brief, ready, turn) {
  const note = replyNote(turn);
  const read = blocksRead(turn);
  return [
    'BLOCKED: this questionnaire is not ready to send (KIT-D129, KIT-T846).',
    ...(ready.length ? ['', 'The topic is not ready to ask:', ...lines(ready), '  Discuss it in prose first; ask once it has converged and the choice is his.'] : []),
    ...(brief.prose.length ? [
      '', 'The brief before the questionnaire is too thin. The options cannot carry the context, so the prose must:', ...(note ? [`  ${note}`] : []), ...lines(brief.prose),
      ...(read.length ? ['', `Blocks read from this turn (newest ${BLOCKS_SHOWN}, oldest first):`, ...read] : []),
      '', 'The questionnaire\'s own question text is read as a brief too. Read that way it lacks', `  ${brief.questions.map((p) => p.part).join(', ')}.`,
      '', 'A brief holds:', ...BRIEF_STANDARD.map((s) => `  * ${s}`)] : []),
    '',
    'Every requirement of a questionnaire, before you resend: q gates question',
    ...(ready.length ? [excludeFooter(READY_CHECK)] : []),
    ...(brief.prose.length ? [excludeFooter(BRIEF_CHECK)] : []),
  ].join('\n');
}

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const turn = p.transcript_path ? await turnTextForCall(p.transcript_path, p.tool_use_id) : null;
  if (!Array.isArray(questions) || !questions.length || !turn) process.exit(0);
  const root = gitRoot();
  const ready = enabled(root, READY_CHECK) ? readinessProblems(turn.lastUser, questions) : [];
  const brief = enabled(root, BRIEF_CHECK) ? briefVerdict(turn.prose, questions) : { prose: [], questions: [] };
  if (ready.length || brief.prose.length) {
    process.stderr.write(blockMessage(brief, ready, turn));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
