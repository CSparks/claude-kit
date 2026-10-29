#!/usr/bin/env node
// PreToolUse(SendMessage) — a message to an existing agent resumes it without creating a row, so
// the row keeps the label of its original dispatch (KIT-T461). Two checks on the target's roster row:
//   - no model: warn, so an unlabelled agent is named at the moment it is woken (KIT-T461).
//   - context past the ceiling (KIT-D116): BLOCK the resume, because every call re-sends the whole
//     context. The one message allowed is the handoff request, marked `[write-handoff]`;
//     `[resume-over-ceiling: <reason>]` overrides. Check-id: agent-context-ceiling.
// Fail-open: a throw exits 0.

import { gitRoot, adopted, payload, readAgents, pathExcluded, excludeFooter } from './lib.mjs';
import { modelDisplay } from './model-tag.mjs';
import { WRITE_HANDOFF, ceilingFlag } from './lib/agent-context.mjs';

const CHECK_ID = 'agent-context-ceiling';
const OVERRIDE = /\[resume-over-ceiling:\s*[^\]\s][^\]]*\]/i;

main().catch(() => process.exit(0));

async function main() {
  try {
    const p = await payload();
    const root = gitRoot();
    if (!adopted(root)) process.exit(0);
    const input = p.tool_input || {};
    const target = [input.to, input.agent_id, input.agentId].find((v) => typeof v === 'string' && v.trim());
    if (!target) process.exit(0);
    const row = readAgents(root, undefined, { reconcile: false }).find((r) => r.id === target.trim());
    if (row && !modelDisplay(row.model)) {
      process.stderr.write(`!! resuming ${row.id} (${row.scope || '?'}): its roster row carries no model, so its panel row shows none (KIT-T461). Re-dispatch it with an explicit model if it keeps running.\n`);
    }
    const message = String(input.message ?? input.prompt ?? '');
    const flag = row ? ceilingFlag(row) : '';
    if (flag && !WRITE_HANDOFF.test(message) && !OVERRIDE.test(message) && !pathExcluded(root, CHECK_ID, root)) {
      process.stderr.write(`BLOCKED: resuming ${row.id} (${row.scope || '?'}), a past-ceiling agent.\n${flag.trim()}\nBrief a fresh agent from the ticket and its Notes after the handoff. To resume anyway: [resume-over-ceiling: <reason>].\n\n${excludeFooter(CHECK_ID)}\n`);
      process.exit(2);
    }
  } catch {
    /* fail-open */
  }
  process.exit(0);
}
