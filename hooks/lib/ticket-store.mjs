// ticket-store.mjs — which checkout's store holds a ticket, and whether an agent owns it.
//
//   ticketStore(root, ticket, table?)            -> the checkout whose `.ai/tickets` holds `ticket` (root first, then the
//                                                   registered project whose id key prefixes it), or null
//   ownedTickets(root, row, tickets, table?)     -> the `tickets` a roster row owns: its brief cited them AND they live in
//                                                   the checkout it works in (`targetRoot`, else the dispatching root)

import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { projectTable } from '../../scripts/cap-routing.mjs';

const KEY_OF_ID = /^([A-Z0-9]+)-T\d+$/;
function canonical(path) {
  const abs = resolve(String(path));
  try { return realpathSync.native(abs).replace(/\\/g, '/').toLowerCase(); } catch { return abs.replace(/\\/g, '/').toLowerCase(); }
}
const sameTree = (a, b) => canonical(a) === canonical(b);

export function ticketStore(root, ticket, table = projectTable()) {
  if (ticketNotes(root, ticket) !== null) return root;
  const key = KEY_OF_ID.exec(ticket)?.[1];
  const project = key && table.find((p) => p.key && p.key.toUpperCase() === key);
  const repo = project && dirname(project.aiDir);
  return repo && ticketNotes(repo, ticket) !== null ? repo : null;
}

export function ownedTickets(root, row, tickets, table = projectTable()) {
  const wanted = new Set(tickets);
  return (row.tickets || []).filter((t) => {
    if (!wanted.has(t)) return false;
    const store = ticketStore(root, t, table);
    return !!store && sameTree(row.targetRoot || root, store);
  });
}
