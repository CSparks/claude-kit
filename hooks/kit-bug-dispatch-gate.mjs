#!/usr/bin/env node
// Stop — the KIT-BUG DISPATCH gate (KIT-T699). Filing a kit bug dispatches nothing: a high or critical kit
// ticket this session filed or saw (its id is in the transcript) while no Agent call (or SendMessage to the standing
// kit agent or the session holding the checkout, inside the claim window) names that id sits open, and the next session meets it again. A ticket `doing` and touched within the
// claim window (kit-bug.mjs) is held by a live kit agent of any session and never counts as open (KIT-T768). Blocks the stop ONCE per distinct set of such ids, naming
// them and the dispatch required. A ticket labelled kit-queue (the broker's rolling time-sink tickets) belongs to the kit agent's queue and never counts. `stop_hook_active` allows; fails open on any error.
// Check-id: kit-bug-dispatch (path glob matched against the ticket id).

import { readFileSync } from 'node:fs';
import { firstSighting } from './block-once.mjs';
import { gitRoot, pathExcluded, payload, excludeFooter } from './lib.mjs';
import { openKitBugPage, CLAIM_TTL_MS } from '../scripts/kit-bug.mjs';

const CHECK_ID = 'kit-bug-dispatch';
const URGENT = new Set(['critical', 'high']);
const PAGE_LIMIT = 500;
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);
const HANDOFF_TOOL = 'SendMessage';

// A bare T### in a message that names a full KEY-T### id resolves to that key (KIT-T809): the text gains the
// expanded id for every key the message names.
function withBareIdsExpanded(text) {
  const keys = new Set([...text.matchAll(new RegExp(String.raw`\b([A-Z][A-Z0-9]+)-T\d{1,4}\b`, 'g'))].map((m) => m[1]));
  if (!keys.size) return text;
  const bare = [...text.matchAll(/(?<![-\w])T(\d{1,4})\b/g)].map((m) => m[1]);
  return [text, ...[...keys].flatMap((key) => bare.map((n) => `${key}-T${n}`))].join(' ');
}

// A dispatch counts for the session's life. A hand-off (SendMessage to the standing kit agent or the
// session holding the kit checkout, KIT-D123) counts while it is inside the claim window; after that
// with no claim the ticket is open again. An entry with no timestamp counts (fail open).
function dispatchedText(lines, now) {
  const out = [];
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    const at = Date.parse(entry.timestamp);
    const fresh = Number.isNaN(at) || now - at < CLAIM_TTL_MS;
    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      if (DISPATCH_TOOLS.has(block.name) || (block.name === HANDOFF_TOOL && fresh)) out.push(withBareIdsExpanded(JSON.stringify(block.input || {})));
    }
  }
  return out.join('\n');
}

try {
  const p = await payload();
  if (p.stop_hook_active || !p.transcript_path) process.exit(0);
  const transcript = readFileSync(p.transcript_path, 'utf8');
  const dispatched = dispatchedText(transcript.split('\n'), Date.now());
  const root = gitRoot();
  const open = openKitBugPage(PAGE_LIMIT).bugs
    .filter((b) => URGENT.has(b.priority) && !b.queued && new RegExp(`\\b${b.id}\\b`).test(transcript) && !dispatched.includes(b.id) && !pathExcluded(root, CHECK_ID, b.id));
  if (!open.length) process.exit(0);
  if (!firstSighting(`kit-bug-dispatch-${p.session_id || 'nosession'}`, open.map((b) => b.id).join(','))) process.exit(0);
  process.stderr.write(`
BLOCKED: ${open.length} high/critical kit ticket(s) seen this session have no agent dispatched (filing a ticket dispatches nothing):
${open.map((b) => `  ${b.id} [${b.priority}] ${b.title.slice(0, 100)}`).join('\n')}
Dispatch the standing kit agent in the claude-kit checkout with the ticket id in the brief (Agent call), then stop again.
If another session's kit agent already holds the checkout (KIT-D123), SendMessage it (or its session) naming the ticket id instead: that hand-off holds until the holder claims the ticket and lapses after 4 h with no claim.
${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* a gate never wedges a stop on its own error */
}
process.exit(0);
