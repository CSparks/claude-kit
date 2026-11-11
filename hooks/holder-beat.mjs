#!/usr/bin/env node
// PreToolUse (Write|Edit) — the heartbeat of the checkout-holder registry (KIT-T811). Every edit marks its session as
// the live writer of the file's checkout, so dispatch-guard can refuse a second session's writer dispatch there.
// Store (.ai/) files are record-keeping, not a writer's source: they never beat.
// In the claude-kit checkout (KIT-D155) an edit is refused only when another live session has uncommitted changes to
// that same file; every other edit beats and passes. Fails open on any error.

import { payload, gitRoot, gitRootOfFile, isStorePath, pathExcluded, excludeFooter } from './lib.mjs';
import { beatHolder, refuseEdit } from './lib/checkout-holder.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { isKitCheckout } from './lib/kit-checkout.mjs';
import { overlapLines } from './lib/session-overlap.mjs';
import { overlappingHolders } from './lib/live-claims.mjs';
import { repoRelative } from './turn-writes.mjs';
import { HOLDER_CHECK } from './dispatch-holder.mjs';

const blockMessage = (file, found, tree) => [
  `BLOCKED: another live session has uncommitted changes to ${file} (KIT-D155).`,
  `  tree: ${tree}`,
  ...overlapLines(found),
  '',
  'Two sessions writing one file lose work. Wait until that session commits it, or send it the change.',
  'Sessions on other files raise no flag here.',
  excludeFooter(HOLDER_CHECK),
].join('\n');

try {
  const p = await payload();
  const file = (p.tool_input && (p.tool_input.file_path || p.tool_input.path)) || '';
  const tree = file && !isStorePath(file) ? gitRootOfFile(file) : '';
  const agent = subagentId(p);
  if (tree && p.session_id) {
    const rel = isKitCheckout(tree) ? repoRelative(tree, file) : '';
    const found = rel && !pathExcluded(tree, HOLDER_CHECK, file) ? overlappingHolders({ tree, session: p.session_id, paths: [rel] }) : [];
    if (found.length) {
      refuseEdit({ tree, session: p.session_id, path: rel });
      process.stderr.write(blockMessage(rel, found, tree));
      process.exit(2);
    }
    beatHolder({ tree, session: p.session_id, agent, origin: gitRoot(), edited: rel, label: agent ? String(p.agent_type || 'subagent') : 'main thread' });
  }
} catch {
  /* a heartbeat never wedges an edit */
}
process.exit(0);
