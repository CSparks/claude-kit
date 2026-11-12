#!/usr/bin/env node
// PreToolUse (ExitPlanMode) — a plan leaves plan mode only with its framework citation (KIT-T1095).
// In a repo that uses a framework with a crate index, the plan text carries `[framework-checked: <indexed crates read,
// per mechanism>]` or `[framework-checked: none apply: <why>]`; the same check guards a plan or design dispatch.
// exit 2 = block, 0 = allow. No-ops on unadopted repos and an empty plan; FAIL-OPEN on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { FRAMEWORK_CHECK, frameworkFirstBlock } from './dispatch-framework.mjs';

try {
  const p = await payload();
  const plan = String((p.tool_input && p.tool_input.plan) || '');
  const root = gitRoot();
  if (!plan.trim() || !adopted(root) || pathExcluded(root, FRAMEWORK_CHECK, root)) process.exit(0);
  const block = frameworkFirstBlock({ root, subject: 'plan', text: plan, footer: excludeFooter(FRAMEWORK_CHECK) });
  if (!block) process.exit(0);
  console.error([block, '', 'Every requirement and tag form of a plan exit, before you resend: q gates plan'].join('\n'));
  process.exit(2);
} catch {
  process.exit(0);
}
