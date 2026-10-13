#!/usr/bin/env node
// PreToolUse(SendMessage) — a message to an existing agent resumes it without creating a row, so
// the row keeps the label of its original dispatch (KIT-T461). This hook looks the target up in
// the roster and warns when that row carries no model, so an unlabelled agent is named at the
// moment it is woken. Observes only: always exit 0, fail-open.

import { gitRoot, adopted, payload, readAgents } from './lib.mjs';
import { modelDisplay } from './model-tag.mjs';

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
  } catch {
    /* fail-open */
  }
  process.exit(0);
}
