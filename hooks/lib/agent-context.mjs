// agent-context.mjs — the warm-reuse context ceiling and the handoff that retires an agent (KIT-D116).
// Every tool call re-sends the whole context, so an agent past `dispatch.context_ceiling_tokens` is
// retired after a written handoff, never resumed.
//
//   contextCeiling()                 -> the ceiling in tokens (kit config)
//   contextTokens(row)               -> an agent's context size: its row's `tokens`, else (in-flight) its live transcript tail
//   overCeiling(rows)                -> [{ row, tokens }] for the rows past the ceiling
//   ceilingFlag(row)                 -> '' under the ceiling, else the one-line flag orient and the guards print, ending with what the
//                                       context is made of (context-breakdown.mjs) when the row names its transcript (`transcript` or `outputFile`)
//   handoffRequest(row)              -> the SendMessage text that asks a past-ceiling agent for its handoff
//   hasHandoff(notes, agentId)       -> does a ticket's Notes carry a `Handoff` block with Jobs:, State:, Next:, Files: whose heading
//                                       names the agent or names no agent id
//   missingHandoffs(root, rows, tickets) -> past-ceiling WRITER rows owning a todo or doing one of `tickets` (ticket-store.mjs) whose
//                                           handoff is not in the ticket Notes yet; read-only agents own no work and never appear
//   WRITE_HANDOFF                    -> the token that marks a resume message as the handoff request

import { readLadder } from '../../scripts/dispatch-ladder.mjs';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { lastContextTokens } from '../agent-outcome.mjs';
import { breakdownLine } from './context-breakdown.mjs';
import { readOnlyRow } from '../dispatch-readonly.mjs';
import { ownedTickets, ticketMeta, ticketStore } from './ticket-store.mjs';
import { TOKENS } from './gate-tokens.mjs';

export const WRITE_HANDOFF = TOKENS.writeHandoff.pattern;
const HANDOFF_LABELS = ['Jobs', 'State', 'Next', 'Files'];
const ID_PREFIX_CHARS = 8;
const TOKENS_PER_K = 1000;

export const contextCeiling = () => readLadder().contextCeilingTokens;

export function contextTokens(row) {
  if (Number.isFinite(row?.tokens)) return row.tokens;
  if (row?.status === 'in-flight' && row.outputFile) return lastContextTokens(row.outputFile);
  return undefined;
}

export function overCeiling(rows, ceiling = contextCeiling()) {
  return rows.map((row) => ({ row, tokens: contextTokens(row) })).filter((r) => r.tokens > ceiling);
}

export function handoffRequest(row) {
  return `[write-handoff] Write a "Handoff ${row.id}" block in the Notes of ${(row.tickets || ['your ticket']).join(', ')} with the labelled lines Jobs:, State:, Next:, Files: (job ids, state, next steps, file pointers), then stop.`;
}

export function ceilingFlag(row) {
  const tokens = contextTokens(row);
  const ceiling = contextCeiling();
  if (!(tokens > ceiling)) return '';
  const k = (n) => `${Math.round(n / TOKENS_PER_K)}k`;
  const made = breakdownLine(row.transcript || row.outputFile, tokens, row.id);
  return ` !! CONTEXT ${k(tokens)} > ${k(ceiling)} ceiling (KIT-D116): retire, do not resume. Request the handoff first: SendMessage ${row.id} "${handoffRequest(row)}"${made ? ` Composition: ${made}` : ''}`;
}

const HANDOFF_HEAD = /^[ \t]*(?:#{1,6}[ \t]*|\*\*)?Handoff\b[^\n]*/gim;
const AGENT_ID_TOKEN = /\b[0-9a-f]{8,}\b/i;
const OPEN_STATUSES = new Set(['todo', 'doing', '']);

const hasLabels = (block) => HANDOFF_LABELS.every((label) => new RegExp(String.raw`(?:^|[\s*.;])${label}\**[ \t]*:`, 'i').test(block));

// A Handoff block counts for the agent when its heading carries the agent's id, or carries no agent id at all.
export function hasHandoff(notes, agentId) {
  const text = String(notes || '');
  const prefix = String(agentId).slice(0, ID_PREFIX_CHARS);
  const heads = [...text.matchAll(HANDOFF_HEAD)];
  return heads.some((head, i) => {
    const mine = head[0].includes(prefix) || !AGENT_ID_TOKEN.test(head[0]);
    return mine && hasLabels(text.slice(head.index, heads[i + 1]?.index));
  });
}

const stillOpen = (root, ticket, table) => OPEN_STATUSES.has(ticketMeta(root, ticket, table)?.status ?? '');

// Only a ticket still todo or doing needs the handoff; one the agent finished leaves nothing to carry over.
export function missingHandoffs(root, rows, tickets, table) {
  return overCeiling(rows).map((r) => r.row).filter((row) => {
    if (readOnlyRow(root, row)) return false;
    const owned = ownedTickets(root, row, tickets, table).filter((t) => stillOpen(root, t, table));
    return owned.length > 0 && !owned.some((t) => hasHandoff(ticketNotes(ticketStore(root, t, table), t), row.id));
  });
}
