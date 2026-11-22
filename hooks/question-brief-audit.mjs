#!/usr/bin/env node
// PostToolUse (AskUserQuestion|request_user_input) and Stop — the after-the-call audit of the summary above a
// questionnaire (KIT-D153, KIT-D152, KIT-D129). Check id question-brief; fails open on any error.
//
// PostToolUse  the call is on disk: judge the prose before it; a thin summary is reported as additionalContext
//              (exit 0, an advisory line, never an error). A call whose entry is not in the transcript is left for Stop.
// Stop         the backstop: every questionnaire of this turn not yet audited is judged; a thin one blocks the stop
//              with the same message. Silent when PostToolUse already audited every call.
//
// The same audit reads the summary for an offer to accept a wait over 60 seconds (lib/question-wait-audit.mjs, check id question-wait).
// Each audited call is recorded (lib/question-audits.mjs) so it is judged once and orient can show repeat offenders.

import { payload, gitRoot, pathExcluded, projectName } from './lib.mjs';
import { auditQuestionnaire, auditMessage } from './lib/question-audit.mjs';
import { auditedCalls, recordAudit } from './lib/question-audits.mjs';
import { turnCalls } from './lib/turn-text.mjs';
import { BRIEF_CHECK, WAIT_CHECK } from './lib/question-checks.mjs';
import { summaryWaitOffers, waitAuditMessage } from './lib/question-wait-audit.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const enabled = (root, check) => !root || !pathExcluded(root, check, root);

function audited(p, root, calls) {
  const done = auditedCalls();
  const results = [];
  for (const call of calls.filter((c) => !c.denied && !done.has(c.id))) {
    const audit = auditQuestionnaire(p.transcript_path, call);
    if (!audit) continue;
    const offers = enabled(root, WAIT_CHECK) ? summaryWaitOffers(audit.turn, call) : [];
    recordAudit({ session: p.session_id, project: projectName(root), call: call.id, parts: [...audit.problems.map((x) => x.part), ...(offers.length ? [WAIT_CHECK] : [])] });
    if (audit.problems.length || offers.length) results.push({ call, audit, offers });
  }
  return results;
}

function reportOf(found) {
  const thin = found.filter((r) => r.audit.problems.length);
  return [thin.length ? auditMessage(thin) : '', waitAuditMessage(found.filter((r) => r.offers.length))].filter(Boolean).join('\n\n');
}

try {
  const p = await payload();
  const root = gitRoot();
  if (!p.transcript_path || (root && pathExcluded(root, BRIEF_CHECK, root))) process.exit(0);
  if (p.hook_event_name === 'Stop') {
    if (p.stop_hook_active) process.exit(0);
    const thin = audited(p, root, turnCalls(p.transcript_path, TOOLS));
    if (thin.length) {
      process.stderr.write(reportOf(thin));
      process.exit(2);
    }
  } else if (TOOLS.has(p.tool_name)) {
    const thin = audited(p, root, [{ id: p.tool_use_id, input: p.tool_input }]);
    if (thin.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reportOf(thin) } }));
  }
} catch {
  /* fail open */
}
process.exit(0);
