// agent-context.mjs — the waste measure of an agent's context and the handoff that retires a wasteful agent (KIT-D149, KIT-D158).
// An agent is never retired, blocked or replaced for the SIZE of its context: real work is fine at any size. The only limit is
// waste, the avoidable share of context (bulk tool output, repeated lines, polled waits; context-breakdown.mjs) that the
// session coordinator tracks and acts on.
//
//   WASTE_RETIRE_SHARE               -> the avoidable share above which an agent is flagged
//   WASTE_MIN_TOKENS                 -> the avoidable tokens below which no share flags an agent
//   wasteReport(row)                 -> the waste measurement of the row's transcript (`transcript` or `outputFile`), or null
//   overWaste(rows)                  -> [{ row, waste }] for the rows whose waste share is flagged
//   wasteFlag(row)                   -> '' for an agent with no flagged waste, else the one-line flag orient and the guards print:
//                                       the share, the avoidable lines by name, the fix, the handoff request, the composition
//   handoffRequest(row)              -> the SendMessage text that asks a retiring agent for its handoff
//   handoffCount(notes, agentId)     -> how many Handoff headings the Notes carry for the agent, complete or not
//   hasHandoff(notes, agentId)       -> does a ticket's Notes carry a `Handoff` block with Jobs:, State:, Next:, Files: whose heading
//                                       names the agent or names no agent id
//   missingHandoffs(root, rows, tickets) -> flagged WRITER rows owning a todo or doing one of `tickets` (ticket-store.mjs) whose
//                                           handoff is not in the ticket Notes yet; read-only agents own no work and never appear
//   WRITE_HANDOFF                    -> the token that marks a resume message as the handoff request

import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { lastContextTokens } from '../agent-outcome.mjs';
import { breakdownLine, wasteOf } from './context-breakdown.mjs';
import { readOnlyRow } from '../dispatch-readonly.mjs';
import { ownedTickets, ticketMeta, ticketStore } from './ticket-store.mjs';
import { TOKENS } from './gate-tokens.mjs';

export const WRITE_HANDOFF = TOKENS.writeHandoff.pattern;
export const WASTE_RETIRE_SHARE = 0.5;
export const WASTE_MIN_TOKENS = 5000;
const HANDOFF_LABELS = ['Jobs', 'State', 'Next', 'Files'];
const ID_PREFIX_CHARS = 8;
const PERCENT = 100;
const TOKENS_PER_K = 1000;
const NAMED_LINES = 3;

const transcriptOf = (row) => row?.transcript || row?.outputFile;

export function contextTokens(row) {
  if (Number.isFinite(row?.tokens)) return row.tokens;
  if (row?.status === 'in-flight' && row.outputFile) return lastContextTokens(row.outputFile);
  return undefined;
}

export const wasteReport = (row) => wasteOf(transcriptOf(row));

const flagged = (waste) => Boolean(waste) && waste.garbage > WASTE_RETIRE_SHARE && waste.avoidableTokens >= WASTE_MIN_TOKENS;

export function overWaste(rows) {
  return rows.map((row) => ({ row, waste: wasteReport(row) })).filter((r) => flagged(r.waste));
}

export function handoffRequest(row) {
  return `[write-handoff] Write a "Handoff ${row.id}" block in the Notes of ${(row.tickets || ['your ticket']).join(', ')} with the labelled lines Jobs:, State:, Next:, Files: (job ids, state, next steps, file pointers), then stop.`;
}

const k = (n) => `${Math.round(n / TOKENS_PER_K)}k`;

export function wasteFlag(row) {
  const waste = wasteReport(row);
  if (!flagged(waste)) return '';
  const named = waste.avoidable.slice(0, NAMED_LINES).map((r) => `${r.label} ${k(r.tokens)}`).join('; ');
  const made = breakdownLine(transcriptOf(row), contextTokens(row), row.id);
  return ` !! WASTE ${Math.round(waste.garbage * PERCENT)}% of context (${k(waste.avoidableTokens)}) is avoidable (KIT-D149): the session coordinator retires or redirects this agent. Avoidable: ${named}. Fix: ${waste.hints.join('; ')}. Request the handoff first: SendMessage ${row.id} "${handoffRequest(row)}"${made ? ` Composition: ${made}` : ''}`;
}

const HANDOFF_HEAD = /^[ \t]*(?:#{1,6}[ \t]*|\*\*)?Handoff\b[^\n]*/gim;
const AGENT_ID_TOKEN = /\b[0-9a-f]{8,}\b/i;
const OPEN_STATUSES = new Set(['todo', 'doing', '']);

const hasLabels = (block) => HANDOFF_LABELS.every((label) => new RegExp(String.raw`(?:^|[\s*.;])${label}\**[ \t]*:`, 'i').test(block));

// A Handoff block counts for the agent when its heading carries the agent's id, or carries no agent id at all.
function mineHeads(notes, agentId) {
  const text = String(notes || '');
  const prefix = String(agentId).slice(0, ID_PREFIX_CHARS);
  const heads = [...text.matchAll(HANDOFF_HEAD)];
  return heads.map((head, i) => ({ complete: hasLabels(text.slice(head.index, heads[i + 1]?.index)), mine: head[0].includes(prefix) || !AGENT_ID_TOKEN.test(head[0]) })).filter((h) => h.mine);
}

export const hasHandoff = (notes, agentId) => mineHeads(notes, agentId).some((h) => h.complete);

export const handoffCount = (notes, agentId) => mineHeads(notes, agentId).length;

const stillOpen = (root, ticket, table) => OPEN_STATUSES.has(ticketMeta(root, ticket, table)?.status ?? '');

// Only a ticket still todo or doing needs the handoff; one the agent finished leaves nothing to carry over.
export function missingHandoffs(root, rows, tickets, table) {
  return overWaste(rows).map((r) => r.row).filter((row) => {
    if (readOnlyRow(root, row)) return false;
    const owned = ownedTickets(root, row, tickets, table).filter((t) => stillOpen(root, t, table));
    return owned.length > 0 && !owned.some((t) => hasHandoff(ticketNotes(ticketStore(root, t, table), t), row.id));
  });
}
