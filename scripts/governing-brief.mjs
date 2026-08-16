// governing-brief.mjs — the GOVERNING DECISIONS a handoff brief must carry (KIT-T232).
//
// Two sources, one list: `q governing <files>` (decisions/tickets whose declared paths cover
// the ticket's files) and `q trail <id>` (the ticket's own ancestry, decisions only). Each row
// is flagged `parked` when its title/body says the area is parked/deferred/legacy/frozen/
// superseded — the signal that dispatching onto it is a process failure, not work.
//
//   governingRows(id, files, root) -> [{ id, store, status, via, summary, parked }]

import { collectItems } from './db-parse.mjs';
import { query } from './q.mjs';
import { clip, SUMMARY_CLIP } from './q-model.mjs';

// A parking/retirement declaration in a decision's title or body. Deliberately literal — a
// false positive costs one line of the maintainer's attention; a false negative costs a
// dispatch onto a dead build.
export const PARKED_RE = /\b(parked|parking|on ice|deferred|shelved|legacy|superseded|frozen|freeze|retired)\b/i;

export const isParked = (item) => !!item && PARKED_RE.test(`${item.title || ''}\n${item.body || ''}`);

function itemIndex(root) {
  const map = new Map();
  try {
    for (const it of collectItems(root)) if (it.id) map.set(it.id, it);
  } catch {
    /* fail-open: no index means no parked flags, never a broken brief */
  }
  return map;
}

async function rowsOf(cmd, args, root) {
  try {
    const { rows } = await query(cmd, args, { cwdRoot: root });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return []; // a missing/stale cache is not a handoff blocker
  }
}

export async function governingRows(id, files, root) {
  const [byFile, trail] = await Promise.all([
    files.length ? rowsOf('governing', files, root) : Promise.resolve([]),
    rowsOf('trail', [id], root),
  ]);
  const index = itemIndex(root);
  const out = [];
  const seen = new Set();
  const push = (rowId, store, status, via, summary) => {
    if (!rowId || rowId === id || seen.has(rowId)) return;
    seen.add(rowId);
    const item = index.get(rowId);
    out.push({
      id: rowId,
      store,
      status: status || (item ? item.status : ''),
      via,
      summary: clip(summary || (item ? (item.summary || item.title) : ''), SUMMARY_CLIP),
      parked: isParked(item),
    });
  };
  for (const r of byFile) push(r.id, r.store, r.status, `files:${r.matched}`, r.summary);
  for (const t of trail) {
    if (t.rel === 'self' || t.store !== 'decisions') continue;
    push(t.id, t.store, '', 'trail', t.summary);
  }
  return out;
}

// Markdown rendering of the block a dispatcher reads BEFORE handing the ticket to an agent.
export function renderGoverning(rows) {
  const lines = ['## GOVERNING DECISIONS — read before dispatch'];
  if (!rows.length) {
    lines.push('- (none govern this ticket\'s files/area)');
    return lines;
  }
  for (const r of rows) {
    const flag = r.parked ? '!! PARKED? ' : '';
    lines.push(`- ${flag}**${r.id}** (${r.store}, via ${r.via}) — ${r.summary}`);
  }
  if (rows.some((r) => r.parked)) {
    lines.push('');
    lines.push('A `!! PARKED?` decision means the area may be parked/legacy — confirm with the maintainer before dispatching.');
  }
  return lines;
}
