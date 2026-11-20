#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — each question carries its own plain summary in its question field
// (KIT-T1448; lib/question-self-contained.mjs). exit 2 = block, 0 = allow. Check id question-self-contained (path glob
// subject: the repo root). Fails open on any parse error and on a payload with no questions.

import { payload, gitRoot, pathExcluded, excludeFooter } from './lib.mjs';
import { SELF_CONTAINED_CHECK, selfContainedMessage, selfContainedProblems } from './lib/question-self-contained.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  if (!Array.isArray(questions) || !questions.length) process.exit(0);
  const root = gitRoot();
  if (root && pathExcluded(root, SELF_CONTAINED_CHECK, root)) process.exit(0);
  const problems = selfContainedProblems(questions);
  if (problems.length) {
    process.stderr.write(selfContainedMessage(problems, excludeFooter(SELF_CONTAINED_CHECK)));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
