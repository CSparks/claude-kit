#!/usr/bin/env node
// PostToolUse (AskUserQuestion|request_user_input) and Stop — the after-the-call audit of the summary above a
// questionnaire (KIT-D153, KIT-D152, KIT-D129). Check id question-brief; fails open on any error.
//
// PostToolUse  the call is on disk: judge the prose before it; a thin summary is reported as additionalContext
//              (exit 0, an advisory line, never an error). A call whose entry is not in the transcript is left for Stop.
// Stop         the backstop: every questionnaire of this turn not yet audited is judged; a thin one blocks the stop
//              with the same message. Silent when PostToolUse already audited every call.
//
// Each audited call is recorded (lib/question-audits.mjs) so it is judged once and orient can show repeat offenders.

import { payload, gitRoot, pathExcluded, projectName } from './lib.mjs';
import { auditQuestionnaire, auditMessage } from './lib/question-audit.mjs';
import { auditedCalls, recordAudit } from './lib/question-audits.mjs';
import { turnCalls } from './lib/turn-text.mjs';
import { BRIEF_CHECK } from './lib/question-checks.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);

function audited(p, root, calls) {
  const done = auditedCalls();
  const results = [];
  for (const call of calls.filter((c) => !c.denied && !done.has(c.id))) {
    const audit = auditQuestionnaire(p.transcript_path, call);
    if (!audit) continue;
    recordAudit({ session: p.session_id, project: projectName(root), call: call.id, parts: audit.problems.map((x) => x.part) });
    if (audit.problems.length) results.push({ call, audit });
  }
  return results;
}

try {
  const p = await payload();
  const root = gitRoot();
  if (!p.transcript_path || (root && pathExcluded(root, BRIEF_CHECK, root))) process.exit(0);
  if (p.hook_event_name === 'Stop') {
    if (p.stop_hook_active) process.exit(0);
    const thin = audited(p, root, turnCalls(p.transcript_path, TOOLS));
    if (thin.length) {
      process.stderr.write(auditMessage(thin));
      process.exit(2);
    }
  } else if (TOOLS.has(p.tool_name)) {
    const thin = audited(p, root, [{ id: p.tool_use_id, input: p.tool_input }]);
    if (thin.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: auditMessage(thin) } }));
  }
} catch {
  /* fail open */
}
process.exit(0);
