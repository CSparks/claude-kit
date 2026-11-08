// Shared by the question-brief tests: run the after-the-call audit hook (question-brief-audit.mjs) as Claude Code
// does for PostToolUse, on a fresh audit record so a repeated call id is judged each time.
//   auditAsk(payload, cwd, env?) -> { code, out }   code 2 = the audit reported a thin summary (additionalContext), 0 = silent
//   auditStop(payload, cwd, env?) -> { code, out }  the Stop backstop; code 2 = it blocked the stop
//   freshState()                                    an env fragment pointing the audit record at an empty directory

import { hook, tmpDir } from './test-harness.mjs';

const AUDIT = 'question-brief-audit.mjs';
const THIN = 2;

export const freshState = () => ({ CLAUDE_KIT_REAP_STAMP_DIR: tmpDir('audit-state-') });

function additionalContext(out) {
  try { return JSON.parse(out).hookSpecificOutput?.additionalContext || ''; } catch { return ''; }
}

export function auditAsk(payload, cwd, env = freshState()) {
  const r = hook(AUDIT, { hook_event_name: 'PostToolUse', ...payload }, cwd, env);
  const context = additionalContext(r.out);
  return { code: r.code === 0 && context ? THIN : r.code, out: context || r.out };
}

export const auditStop = (payload, cwd, env = freshState()) => hook(AUDIT, { hook_event_name: 'Stop', ...payload }, cwd, env);
