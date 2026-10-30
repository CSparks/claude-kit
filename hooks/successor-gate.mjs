#!/usr/bin/env node
// Stop — the SUCCESSOR gate (KIT-T718). An agent that retired with a `Handoff <id>` block in its ticket's Notes left open
// work; the orchestrator saying "a fresh agent takes over" dispatches nothing. Blocks the stop ONCE per distinct set of
// such tickets until a dispatch cites each (roster row), the ticket reaches review/done, or the ticket is excluded.
// `stop_hook_active` allows; fails open on any error.
// Check-id: successor (path glob matched against the ticket id).

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, pathExcluded, payload, readAgents } from './lib.mjs';
import { pendingSuccessors } from './lib/successor.mjs';

const CHECK_ID = 'successor';

try {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const pending = pendingSuccessors(root, readAgents(root)).filter((s) => !pathExcluded(root, CHECK_ID, s.ticket));
  if (!pending.length) process.exit(0);
  if (!firstSighting(`successor-${p.session_id || 'nosession'}`, pending.map((s) => `${s.row.id}:${s.ticket}`).join(','))) process.exit(0);
  process.stderr.write(`
BLOCKED: ${pending.length} ticket(s) have an agent that retired with a Handoff and no successor dispatched (KIT-T718):
${pending.map((s) => `  ${s.ticket}: ${s.row.id} (${s.row.scope || '?'}) wrote its handoff; no dispatch has cited ${s.ticket} since`).join('\n')}
Dispatch a fresh agent with the ticket id in the brief, briefed from the ticket and that handoff (Agent call), then stop again.
${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* a gate never wedges a stop on its own error */
}
process.exit(0);
