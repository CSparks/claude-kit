#!/usr/bin/env node
// Stop — the KIT-BUG DISPATCH gate (KIT-T699). Filing a kit bug dispatches nothing: a high or critical kit
// ticket this session filed or saw (its id is in the transcript) while no Agent call names that id sits
// open, and the next session meets it again. Blocks the stop ONCE per distinct set of such ids, naming
// them and the dispatch required. `stop_hook_active` allows; fails open on any error.
// Check-id: kit-bug-dispatch (path glob matched against the ticket id).

import { readFileSync } from 'node:fs';
import { firstSighting } from './block-once.mjs';
import { gitRoot, pathExcluded, payload, excludeFooter } from './lib.mjs';
import { openKitBugPage } from '../scripts/kit-bug.mjs';

const CHECK_ID = 'kit-bug-dispatch';
const URGENT = new Set(['critical', 'high']);
const PAGE_LIMIT = 500;
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

function dispatchedText(lines) {
  const out = [];
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) if (block?.type === 'tool_use' && DISPATCH_TOOLS.has(block.name)) out.push(JSON.stringify(block.input || {}));
  }
  return out.join('\n');
}

try {
  const p = await payload();
  if (p.stop_hook_active || !p.transcript_path) process.exit(0);
  const transcript = readFileSync(p.transcript_path, 'utf8');
  const dispatched = dispatchedText(transcript.split('\n'));
  const root = gitRoot();
  const open = openKitBugPage(PAGE_LIMIT).bugs
    .filter((b) => URGENT.has(b.priority) && new RegExp(`\\b${b.id}\\b`).test(transcript) && !dispatched.includes(b.id) && !pathExcluded(root, CHECK_ID, b.id));
  if (!open.length) process.exit(0);
  if (!firstSighting(`kit-bug-dispatch-${p.session_id || 'nosession'}`, open.map((b) => b.id).join(','))) process.exit(0);
  process.stderr.write(`
BLOCKED: ${open.length} high/critical kit ticket(s) seen this session have no agent dispatched (filing a ticket dispatches nothing):
${open.map((b) => `  ${b.id} [${b.priority}] ${b.title.slice(0, 100)}`).join('\n')}
Dispatch the standing kit agent in the claude-kit checkout with the ticket id in the brief (Agent call), then stop again.
${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* a gate never wedges a stop on its own error */
}
process.exit(0);
