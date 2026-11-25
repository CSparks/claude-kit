#!/usr/bin/env node
// PostToolUse (Write|Edit) — an advisory, never a block (KIT-T1532). The first time a session writes a plan file under
// ~/.claude/plans/ in a repo that uses a framework with a crate index, it is told what ExitPlanMode will ask of the plan
// (`q gates plan`: the `[framework-checked: …]` tag), so the plan carries it before the exit gate refuses it.
// Once per session; same detection and exclusion as plan-exit-gate. No-ops on unadopted repos; always exit 0, fails open.

import { homedir } from 'node:os';
import { relative, resolve, isAbsolute } from 'node:path';
import { payload, gitRoot, adopted, pathExcluded, readTurnState, writeTurnState } from './lib.mjs';
import { FRAMEWORK_CHECK, crateIndexedFrameworks } from './dispatch-framework.mjs';
import { gateText } from './lib/gate-protocol.mjs';

const PLANS_DIR = resolve(homedir(), '.claude', 'plans');
const SESSION_SLOT = (id) => `plan-notice-${String(id || 'nosession').replace(/[^\w-]/g, '_')}`;

const underPlans = (file) => {
  if (!file) return false;
  const rel = relative(PLANS_DIR, resolve(String(file)));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

try {
  const p = await payload();
  const file = p.tool_input && (p.tool_input.file_path || p.tool_input.path);
  const root = gitRoot();
  if (underPlans(file) && adopted(root) && !pathExcluded(root, FRAMEWORK_CHECK, root) && crateIndexedFrameworks(root).length) {
    const slot = SESSION_SLOT(p.session_id);
    if (!readTurnState(root, slot)) {
      writeTurnState(root, { told: true }, slot);
      const text = [
        'PLAN NOTICE (advisory): this repo uses a framework with a crate index. ExitPlanMode refuses a plan that does not cite the crates it read; put the tag in the plan now.',
        gateText('plan', { root }),
      ].join('\n');
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
    }
  }
} catch {
  /* a notice never wedges a tool call */
}
process.exit(0);
