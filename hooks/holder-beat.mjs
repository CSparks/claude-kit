#!/usr/bin/env node
// PreToolUse (Write|Edit) — the heartbeat of the checkout-holder registry (KIT-T811). Every edit marks its session as
// the live writer of the file's checkout, so dispatch-guard can refuse a second session's writer dispatch there.
// Store (.ai/) files are record-keeping, not a writer's source: they never beat. Never blocks; fails open on any error.

import { payload, gitRoot, gitRootOfFile, isStorePath } from './lib.mjs';
import { beatHolder } from './lib/checkout-holder.mjs';
import { subagentId } from './lib/subagent-id.mjs';

try {
  const p = await payload();
  const file = (p.tool_input && (p.tool_input.file_path || p.tool_input.path)) || '';
  const tree = file && !isStorePath(file) ? gitRootOfFile(file) : '';
  const agent = subagentId(p);
  if (tree && p.session_id) beatHolder({ tree, session: p.session_id, agent, origin: gitRoot(), label: agent ? String(p.agent_type || 'subagent') : 'main thread' });
} catch {
  /* a heartbeat never wedges an edit */
}
process.exit(0);
