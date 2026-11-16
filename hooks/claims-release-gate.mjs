#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — `claims --release` is the main thread's verb (KIT-T1287): a subagent that runs it is refused,
// so no agent can free another's files by declaring it dead. The roster and the claims decide whether the named agent has been
// quiet long enough (scripts/claims.mjs). Check-id claims-release. No-ops on unadopted repos; fails open.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { subagentId } from './lib/subagent-id.mjs';

const CHECK = 'claims-release';
const RELEASE = /(?:^|[^\w-])claims(?:\.mjs|\.cmd)?\b[^;&|\n]*--release\b/i;

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const root = gitRoot();
  if (subagentId(p) && RELEASE.test(command) && adopted(root) && !pathExcluded(root, CHECK, root)) {
    process.stderr.write(`\nBLOCKED: \`claims --release\` is the main thread's verb (KIT-T1287): a subagent cannot declare another agent dead.\nRaise it to the main thread, naming the agent id and why its claims should go.\n${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
