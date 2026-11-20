#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — every questionnaire gate in one hook run (KIT-T1451). The harness reports
// only the first refusing hook of a matcher, so seven separate gates cost one attempt per failing check; this runs them all
// (lib/question-gates-run.mjs QUESTION_GATES) and refuses ONCE with every failure, each with its fix. A gate's own exclusion
// keys, check ids and fail-open rules are unchanged: the gate scripts run as they always did. exit 2 = block, 0 = allow.
// Advisory text a gate prints (decision-gate's related decisions) is passed on as one additionalContext. Fails open on any error.

import { readStdin } from './lib.mjs';
import { QUESTION_GATES, consolidatedBlock, runQuestionGates } from './lib/question-gates-run.mjs';

try {
  const raw = await readStdin();
  const payload = JSON.parse(raw || '{}');
  if (!Array.isArray(payload?.tool_input?.questions) || !QUESTION_GATES.length) process.exit(0);
  const { blocks, context } = await runQuestionGates(payload);
  if (blocks.length) {
    process.stderr.write(consolidatedBlock(blocks));
    process.exit(2);
  }
  if (context.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context.join('\n\n') } }));
} catch {
  /* fail open */
}
process.exit(0);
