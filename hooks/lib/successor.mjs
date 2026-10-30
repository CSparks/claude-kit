// successor.mjs — an agent that retires with a Handoff block leaves its ticket's work to a successor (KIT-T718, KIT-D116).
// The handoff is the record that work is open; a dispatch citing the ticket after the retirement is the successor.
//
//   pendingSuccessors(root, rows, { nowMs }) -> [{ row, ticket }]: done roster rows whose ticket is still open, carries
//                                               that row's `Handoff <id>` block, and has no later dispatch citing it
//   openTicketStatus(root, id)               -> the live ticket's status, or null (no live file: archived or unknown)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hasHandoff } from './agent-context.mjs';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';

const CLOSED = new Set(['review', 'done']);
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STATUS_LINE = /^status:[ \t]*(\S+)/m;

export function openTicketStatus(root, id) {
  const dir = join(root, '.ai', 'tickets');
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
  if (!file) return null;
  const m = STATUS_LINE.exec(readFileSync(join(dir, file), 'utf8'));
  return m ? m[1] : null;
}

const retiredAt = (row) => String(row.ts || row.firstSeen || '');
const recent = (row, nowMs) => nowMs - Date.parse(retiredAt(row)) <= WINDOW_MS;
const succeeded = (rows, row, ticket) => rows.some((r) => r.id !== row.id && (r.tickets || []).includes(ticket) && String(r.firstSeen || r.ts || '') >= retiredAt(row));

export function pendingSuccessors(root, rows, { nowMs = Date.now() } = {}) {
  const out = [];
  for (const row of rows) {
    if (row.status !== 'done' || !recent(row, nowMs)) continue;
    for (const ticket of row.tickets || []) {
      const status = openTicketStatus(root, ticket);
      if (!status || CLOSED.has(status)) continue;
      if (!hasHandoff(ticketNotes(root, ticket), row.id) || succeeded(rows, row, ticket)) continue;
      out.push({ row, ticket });
    }
  }
  return out;
}
