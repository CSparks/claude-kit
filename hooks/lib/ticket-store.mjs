// ticket-store.mjs — which checkout's store holds a ticket, and whether an agent owns it.
//
//   ticketStore(root, ticket, table?)            -> the checkout whose `.ai/tickets` holds `ticket` (root first, then the
//                                                   registered project whose id key prefixes it), or null
//   ticketMeta(root, ticket, table?)             -> { type, status, title } read from the ticket file (tickets, archive,
//                                                   requests), or null when no store holds it.
//   ownedTickets(root, row, tickets, table?)     -> the `tickets` a roster row owns: its brief cited them AND they live in
//                                                   the checkout it works in (`targetRoot`, else the dispatching root)

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { projectTable } from '../../scripts/cap-routing.mjs';
import { field, frontmatterBlock } from '../../scripts/frontmatter.mjs';

const KEY_OF_ID = /^([A-Z0-9]+)-T\d+$/;
const META_DIRS = [['tickets'], ['tickets', 'archive'], ['requests']];

function canonical(path) {
  const abs = resolve(String(path));
  try { return realpathSync.native(abs).replace(/\\/g, '/').toLowerCase(); } catch { return abs.replace(/\\/g, '/').toLowerCase(); }
}
const sameTree = (a, b) => canonical(a) === canonical(b);

function projectRepo(ticket, table) {
  const key = KEY_OF_ID.exec(ticket)?.[1];
  const project = key && table.find((p) => p.key && p.key.toUpperCase() === key);
  return project ? dirname(project.aiDir) : null;
}

export function ticketStore(root, ticket, table = projectTable()) {
  if (ticketNotes(root, ticket) !== null) return root;
  const repo = projectRepo(ticket, table);
  return repo && ticketNotes(repo, ticket) !== null ? repo : null;
}

function metaIn(repo, ticket) {
  for (const parts of META_DIRS) {
    const dir = join(repo, '.ai', ...parts);
    if (!existsSync(dir)) continue;
    const file = readdirSync(dir).find((f) => f.startsWith(`${ticket}-`) && f.endsWith('.md'));
    if (!file) continue;
    const fm = frontmatterBlock(readFileSync(join(dir, file), 'utf8'));
    return { type: field(fm, 'type') || (parts[0] === 'requests' ? 'request' : ''), status: field(fm, 'status'), title: field(fm, 'title') };
  }
  return null;
}

export function ticketMeta(root, ticket, table) {
  const here = metaIn(root, ticket);
  if (here) return here;
  const repo = projectRepo(ticket, table || projectTable());
  return repo ? metaIn(repo, ticket) : null;
}

export function ownedTickets(root, row, tickets, table = projectTable()) {
  const wanted = new Set(tickets);
  return (row.tickets || []).filter((t) => {
    if (!wanted.has(t)) return false;
    const store = ticketStore(root, t, table);
    return !!store && sameTree(row.targetRoot || root, store);
  });
}
