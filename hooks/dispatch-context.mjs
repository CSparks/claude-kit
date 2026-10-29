// dispatch-context — dispatch-guard checks for the context ceiling (KIT-D116):
//   agent-context-ceiling  WARN on every dispatch: roster agents past the ceiling, to be retired not resumed.
//   handoff-before-replace BLOCK a dispatch citing a ticket whose past-ceiling agent has not left the
//                          `Handoff <agent>` block (Jobs:, State:, Next:, Files:) in the ticket Notes.
//                          Escape: [handoff-waived: <reason>].
//
//   ceilingWarning(root)                      -> warning text | null
//   handoffBlock({ root, prompt, footer })    -> block message | null
//   ticketsCited(text)                        -> the ticket ids a brief names

import { readAgents } from './lib.mjs';
import { ceilingFlag, handoffRequest, missingHandoffs, overCeiling } from './lib/agent-context.mjs';

export const CEILING_CHECK = 'agent-context-ceiling';
export const HANDOFF_CHECK = 'handoff-before-replace';
const WAIVED = /\[handoff-waived:\s*[^\]\s][^\]]*\]/i;
const TICKET_ID = /\b[A-Z][A-Z0-9]+-T\d{1,4}\b/g;

export const ticketsCited = (text) => [...new Set(String(text || '').match(TICKET_ID) || [])];

export function ceilingWarning(root) {
  try {
    const over = overCeiling(readAgents(root));
    if (!over.length) return null;
    return ['WARNING: agents past the context ceiling (KIT-D116): retire them after a handoff, do not resume them.', ...over.map((r) => `  ${r.row.id} (${r.row.scope || '?'})${ceilingFlag(r.row)}`)].join('\n');
  } catch {
    return null;
  }
}

export function handoffBlock({ root, prompt, footer }) {
  try {
    if (WAIVED.test(prompt)) return null;
    const cited = ticketsCited(prompt);
    if (!cited.length) return null;
    const missing = missingHandoffs(root, readAgents(root), cited);
    if (!missing.length) return null;
    return [
      'BLOCKED: this dispatch replaces an agent past the context ceiling that has not written its handoff (KIT-D116).',
      ...missing.map((row) => `  ${row.id} (${row.scope || '?'}) on ${(row.tickets || []).join(', ')}: no "Handoff ${row.id}" block with Jobs:, State:, Next:, Files: in the ticket Notes.`),
      '',
      `Ask for it first: SendMessage the agent with: ${handoffRequest(missing[0])}`,
      'Then dispatch the fresh agent, briefed from the ticket and that handoff. A handoff in a session scratchpad does not count: it dies with the session.',
      'Only if the handoff is impossible: include [handoff-waived: <reason>] in the prompt.',
      '',
      footer,
    ].join('\n');
  } catch {
    return null;
  }
}
