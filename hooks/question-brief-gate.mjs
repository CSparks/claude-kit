#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — the questionnaire needs a sufficient brief and a topic that is
// ready to be asked (KIT-D129, KIT-T846). exit 2 = block, 0 = allow.
//
// brief   (check id question-brief)  the assistant's prose this turn meets the content standard (lib/question-brief.mjs)
// ready   (check id question-ready)  the newest maintainer message is not a question or floated idea, and no question
//                                    restates what he already said (lib/question-ready.mjs)
//
// The prose and the maintainer's message come from the transcript, read once it holds this call's own tool_use entry
// (lib/turn-text.mjs). A payload without a readable transcript is allowed.
// Fails open on any error.

import { payload, gitRoot, pathExcluded, excludeFooter } from './lib.mjs';
import { turnTextForCall } from './lib/turn-text.mjs';
import { BRIEF_STANDARD, briefProblems, wordCount } from './lib/question-brief.mjs';
import { readinessProblems } from './lib/question-ready.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const BRIEF_CHECK = 'question-brief';
const READY_CHECK = 'question-ready';

const enabled = (root, check) => !root || !pathExcluded(root, check, root);
const lines = (problems) => problems.map((p) => `  - ${p.part}: ${p.wanted}`);

const NO_TEXT = 'The reply carrying this call has no text block: a thinking block or the questionnaire itself is not prose, and the maintainer sees neither. Write the brief as a normal message in the same reply, before the call. (Counted instead: text from earlier replies this turn.)';
const UNFLUSHED = 'Claude Code writes a reply to the transcript only after hooks have run, so text sent in the same reply as this call cannot be read; only earlier replies this turn were counted. A brief sent in this reply is read once the identical call is resent. A brief sent in an earlier reply was read in full: the parts below are what it lacks, and resending changes nothing until a text message adds them.';
const LEAD_CHARS = 80;

const counted = (turn) => {
  const lead = turn.newestProse.replace(/\s+/g, ' ').slice(0, LEAD_CHARS);
  return lead ? `Counted: ${wordCount(turn.prose)} words of text from this turn; the newest block begins "${lead}".` : 'Counted: no text from this turn.';
};
const replyNote = (turn) => [turn.replyUnflushed ? UNFLUSHED : turn.replyHasText ? '' : NO_TEXT, counted(turn)].filter(Boolean).join(' ');

function blockMessage(brief, ready, turn) {
  const note = replyNote(turn);
  return [
    'BLOCKED: this questionnaire is not ready to send (KIT-D129, KIT-T846).',
    ...(ready.length ? ['', 'The topic is not ready to ask:', ...lines(ready), '  Discuss it in prose first; ask once it has converged and the choice is his.'] : []),
    ...(brief.length ? ['', 'The brief before the questionnaire is too thin. The options cannot carry the context, so the prose must:', ...(note ? [`  ${note}`] : []), ...lines(brief), '', 'A brief holds:', ...BRIEF_STANDARD.map((s) => `  * ${s}`)] : []),
    '',
    ...(ready.length ? [excludeFooter(READY_CHECK)] : []),
    ...(brief.length ? [excludeFooter(BRIEF_CHECK)] : []),
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
  const brief = enabled(root, BRIEF_CHECK) ? briefProblems(turn.prose, questions) : [];
  if (ready.length || brief.length) {
    process.stderr.write(blockMessage(brief, ready, turn));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
