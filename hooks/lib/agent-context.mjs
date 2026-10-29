// agent-context.mjs — the warm-reuse context ceiling and the handoff that retires an agent (KIT-D116).
// Every tool call re-sends the whole context, so an agent past `dispatch.context_ceiling_tokens` is
// retired after a written handoff, never resumed.
//
//   contextCeiling()                 -> the ceiling in tokens (kit config)
//   contextTokens(row)               -> an agent's context size: its row's `tokens`, else (in-flight) its live transcript tail
//   overCeiling(rows)                -> [{ row, tokens }] for the rows past the ceiling
//   ceilingFlag(row)                 -> '' under the ceiling, else the one-line flag orient and the guards print
//   handoffRequest(row)              -> the SendMessage text that asks a past-ceiling agent for its handoff
//   hasHandoff(notes, agentId)       -> does a ticket's Notes carry `Handoff <agent>` with Jobs:, State:, Next:, Files:
//   missingHandoffs(root, rows, tickets) -> past-ceiling rows citing one of `tickets` whose handoff is not in the ticket Notes yet
//   WRITE_HANDOFF                    -> the token that marks a resume message as the handoff request

import { readLadder } from '../../scripts/dispatch-ladder.mjs';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { lastContextTokens } from '../agent-outcome.mjs';

export const WRITE_HANDOFF = /\[write-handoff\]/i;
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
  return ` !! CONTEXT ${k(tokens)} > ${k(ceiling)} ceiling (KIT-D116): retire, do not resume. Request the handoff first: SendMessage ${row.id} "${handoffRequest(row)}"`;
}

export function hasHandoff(notes, agentId) {
  const text = String(notes || '');
  const head = new RegExp(String.raw`^[ \t]*(?:#{1,6}[ \t]*|\*\*)?Handoff[^\n]*${String(agentId).slice(0, ID_PREFIX_CHARS)}`, 'im').exec(text);
  if (!head) return false;
  const block = text.slice(head.index);
  return HANDOFF_LABELS.every((label) => new RegExp(String.raw`^[ \t]*[-*]?[ \t]*\**${label}\**[ \t]*:`, 'im').test(block));
}

export function missingHandoffs(root, rows, tickets) {
  const wanted = new Set(tickets);
  return overCeiling(rows).map((r) => r.row).filter((row) => (row.tickets || []).some((t) => wanted.has(t))
    && !(row.tickets || []).some((t) => wanted.has(t) && hasHandoff(ticketNotes(root, t), row.id)));
}
