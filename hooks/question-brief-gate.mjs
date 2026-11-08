#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — the questionnaire's topic is ready to be asked (KIT-D129, KIT-T846).
// exit 2 = block, 0 = allow.
//
// ready   (check id question-ready)  the newest maintainer message is not a question or floated idea, and no question
//                                    restates what he already said (lib/question-ready.mjs)
//
// The maintainer's message is on disk before the call, so it is read at once. The summary above the questionnaire is
// not judged here: Claude Code has not written the call's own reply yet, so a same-reply summary cannot be read. The
// after-the-call audit judges it (question-brief-audit.mjs, KIT-D152).
// A payload without a readable transcript is allowed. Fails open on any error.

import { payload, gitRoot, pathExcluded, excludeFooter } from './lib.mjs';
import { turnText } from './lib/turn-text.mjs';
import { readinessProblems } from './lib/question-ready.mjs';
import { READY_CHECK } from './lib/question-checks.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const enabled = (root, check) => !root || !pathExcluded(root, check, root);
const lines = (problems) => problems.map((p) => `  - ${p.part}: ${p.wanted}`);

function blockMessage(ready) {
  return [
    'BLOCKED: this questionnaire is not ready to send (KIT-D129, KIT-T846).',
    '',
    'The topic is not ready to ask:',
    ...lines(ready),
    '  Discuss it in prose first; ask once it has converged and the choice is his.',
    '',
    'Every requirement of a questionnaire: q gates question',
    excludeFooter(READY_CHECK),
  ].join('\n');
}

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const turn = p.transcript_path ? turnText(p.transcript_path) : null;
  if (!Array.isArray(questions) || !questions.length || !turn) process.exit(0);
  const ready = enabled(gitRoot(), READY_CHECK) ? readinessProblems(turn.lastUser, questions) : [];
  if (ready.length) {
    process.stderr.write(blockMessage(ready));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
