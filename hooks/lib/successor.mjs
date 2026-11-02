// successor.mjs — an agent that retires with a Handoff block leaves its ticket's work to a successor (KIT-T718, KIT-D116).
// The handoff is the record that work is open; a dispatch citing the ticket after the retirement is the successor.
//
//   pendingSuccessors(root, rows, { nowMs }) -> [{ row, ticket }]: done rows of agents that own ticket work (a
//                                               read-only agent other than a patch-worker hands nothing over) whose ticket is still open, carries that row's `Handoff <id>`
//                                               block, no later dispatch citing it and no recorded close
//   openTicketStatus(root, id)               -> the live ticket's status, or null (no live file: archived or unknown)
//   ticketText(root, id)                     -> the live ticket file's text, or null
//   handoffLines(root, ticket, agentId)      -> the Jobs:, State:, Next:, Files: lines of that agent's Handoff block
//   dispatchedTickets(row)                   -> the tickets the row was dispatched for (its task label), not every id its brief cites
//   handoffClosed(root, ticket, agentId)     -> the handoff owes nothing: its Next says stop / nothing owed, or the ticket
//                                               records `no successor owed [agent <id>]` (ack.mjs --handoff)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hasHandoff } from './agent-context.mjs';
import { ticketsCited } from '../dispatch-context.mjs';
import { ownsWork } from '../dispatch-readonly.mjs';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';

export const CLOSED = new Set(['review', 'done']);
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STATUS_LINE = /^status:[ \t]*(\S+)/m;

export function ticketText(root, id) {
  const dir = join(root, '.ai', 'tickets');
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
  return file ? readFileSync(join(dir, file), 'utf8') : null;
}

export function openTicketStatus(root, id) {
  const m = STATUS_LINE.exec(ticketText(root, id) || '');
  return m ? m[1] : null;
}

export const retiredAt = (row) => String(row.ts || row.firstSeen || '');
export const recent = (row, nowMs) => nowMs - Date.parse(retiredAt(row)) <= WINDOW_MS;
export const succeeded = (root, rows, row, ticket, since = retiredAt(row)) => rows.some((r) => r.id !== row.id && ownsWork(root, r) && (r.tickets || []).includes(ticket) && String(r.firstSeen || r.ts || '') >= since);

const HANDOFF_LABEL = /^[ \t]*[-*]?[ \t]*\**(Jobs|State|Next|Files)\**[ \t]*:/i;
const ID_PREFIX_CHARS = 8;
const HANDOFF_LABEL_COUNT = 4; // Jobs, State, Next, Files
const NEXT_LABEL = /^[-*\s]*\**Next\**[ \t]*:[ \t]*/i;
const NOTHING_OWED = /^(?:none\b|nothing\b|no (?:successor|further|more)\b|n\/a\b|stop(?:ped)?[ \t]*(?:[.;,:()-]|$))/i;
export const NO_SUCCESSOR_MARKER = 'no successor owed';

export function handoffLines(root, ticket, agentId) {
  const notes = String(ticketNotes(root, ticket) || '');
  const head = new RegExp(String.raw`^[ \t]*(?:#{1,6}[ \t]*|\*\*)?Handoff[^\n]*${String(agentId).slice(0, ID_PREFIX_CHARS)}[^\n]*$`, 'im').exec(notes);
  if (!head) return [];
  const labelled = notes.slice(head.index + head[0].length).split('\n').filter((l) => HANDOFF_LABEL.test(l));
  return labelled.slice(0, HANDOFF_LABEL_COUNT).map((l) => l.trim());
}

export function dispatchedTickets(row) {
  const all = row.tickets || [];
  const named = ticketsCited(row.task).filter((t) => all.includes(t));
  return named.length ? named : all;
}

export function handoffClosed(root, ticket, agentId) {
  const prefix = String(agentId).slice(0, ID_PREFIX_CHARS);
  const recorded = String(ticketText(root, ticket) || '').split('\n').some((l) => l.includes(NO_SUCCESSOR_MARKER) && l.includes(prefix));
  if (recorded) return true;
  const next = handoffLines(root, ticket, agentId).find((l) => NEXT_LABEL.test(l));
  return !!next && NOTHING_OWED.test(next.replace(NEXT_LABEL, ''));
}

export function pendingSuccessors(root, rows, { nowMs = Date.now() } = {}) {
  const out = [];
  for (const row of rows) {
    if (row.status !== 'done' || !recent(row, nowMs) || !ownsWork(root, row)) continue;
    for (const ticket of dispatchedTickets(row)) {
      const status = openTicketStatus(root, ticket);
      if (!status || CLOSED.has(status)) continue;
      if (!hasHandoff(ticketNotes(root, ticket), row.id) || succeeded(root, rows, row, ticket) || handoffClosed(root, ticket, row.id)) continue;
      out.push({ row, ticket });
    }
  }
  return out;
}
