#!/usr/bin/env node
// PreToolUse(SendMessage) — a message to an existing agent resumes it without creating a row, so
// the row keeps the label of its original dispatch (KIT-T461). It also acknowledges the agent's finished broker jobs, so
// the hand-back reconciler stops listing them (KIT-T822), and records the tickets the message names as taken over
// (lib/reopened.mjs, KIT-T837); a resume naming no ticket takes over the tickets the agent was dispatched for (KIT-T912). Two checks on the target's roster row:
//   - no model: warn, so an unlabelled agent is named at the moment it is woken (KIT-T461).
//   - waste (KIT-D149, KIT-D158): WARN when most of the agent's context is avoidable output, with the avoidable lines
//     named, so the session coordinator can retire or redirect it. Context SIZE never blocks a resume.
// Fail-open: a throw exits 0.

import { gitRoot, adopted, payload, readAgents, pathExcluded } from './lib.mjs';
import { modelDisplay } from './model-tag.mjs';
import { handoffCount, wasteFlag } from './lib/agent-context.mjs';
import { ticketNotes } from '../scripts/broker/red-run.mjs';
import { brokerDir } from './lib/handback.mjs';
import { ackAgent } from '../scripts/broker/finished-ack.mjs';
import { ticketsCited, WASTE_CHECK } from './dispatch-context.mjs';
import { recordReopen } from './lib/reopened.mjs';
import { dispatchedTickets } from './lib/successor.mjs';

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
    const flag = row && !pathExcluded(root, WASTE_CHECK, root) ? wasteFlag(row) : '';
    if (flag) process.stderr.write(`!! resuming ${row.id} (${row.scope || '?'}):${flag}\n`);
    ackAgent(brokerDir(root), target.trim());
    const named = ticketsCited(message);
    const tickets = named.length || !row ? named : dispatchedTickets(row);
    const agent = row?.id || target.trim();
    recordReopen(root, { agent, tickets, handoffs: Object.fromEntries(tickets.map((t) => [t, handoffCount(ticketNotes(root, t), agent)])) });
  } catch {
    /* fail-open */
  }
  process.exit(0);
}
