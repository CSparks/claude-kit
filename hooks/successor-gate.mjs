#!/usr/bin/env node
// Stop — the OPEN-WORK notice for ended workers (KIT-T718, KIT-T822, KIT-D132). Work a worker left open when it ended any
// way (hand-back, crash, usage limit, killed session) is listed by the reconciler (lib/handback.mjs). This hook never
// blocks a turn and never tells the model to dispatch: it prints one plain OPEN notice per distinct set, per session, for
// the model to relay to the maintainer, whose signed bill of work decides whether any of it runs. Fails open.
// Check-id: successor (path glob matched against the ticket id).

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, pathExcluded, payload, readAgents } from './lib.mjs';
import { reconcileHandbacks } from './lib/handback.mjs';
import { openNotice } from './lib/bill-of-work.mjs';

const CHECK_ID = 'successor';

try {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const items = reconcileHandbacks(root, readAgents(root), { sessionId: p.session_id }).filter((i) => !pathExcluded(root, CHECK_ID, i.ticket || i.job));
  if (!items.length) process.exit(0);
  if (!firstSighting(`successor-${p.session_id || 'nosession'}`, items.map((i) => `${i.key}:${i.step}`).join(','))) process.exit(0);
  const facts = items.map((i) => `  ${i.text}`);
  process.stderr.write(`\n${openNotice(facts, `${items.length} ended worker(s) left work open (KIT-D132).`)}\n${excludeFooter(CHECK_ID)}`);
} catch {
  /* a notice never wedges a stop on its own error */
}
process.exit(0);
