// handback-queued.mjs — a successor dispatch the guard queued behind an in-flight worker (KIT-T828, hooks/lib/queued-dispatch.mjs)
// changes the step the reconciler names for its ticket:
//   blocker still in flight -> step 'queued': the brief is held behind the running worker
//   blocker ended           -> step 'dispatch-queued': the brief is still held; the maintainer's bill decides whether it runs
//
//   applyQueued(root, rows, items) -> items with the steps above for tickets that have a queued row

import { readQueued } from './queued-dispatch.mjs';

export const QUEUED = 'queued';
export const DISPATCH_QUEUED = 'dispatch-queued';
const DISPATCHABLE_STEPS = new Set(['successor', 'fresh-worker']);
const ENDED = new Set(['done', 'error', 'killed', 'stale', 'collected', 'merged']);
const BRIEF_SHOWN = 400;

// The newest row for the ticket queued after the item's agent retired; an older row belongs to an earlier handoff and
// was consumed by the dispatch that followed it.
const liveRow = (queued, item) => queued
  .filter((row) => (row.tickets || []).includes(item.ticket) && String(row.ts || '') >= String(item.retired || ''))
  .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))[0];

export function applyQueued(root, rows, items) {
  const queued = readQueued(root);
  if (!queued.length) return items;
  return items.map((item) => {
    const q = item.ticket && DISPATCHABLE_STEPS.has(item.step) ? liveRow(queued, item) : null;
    if (!q) return item;
    const blocker = rows.find((r) => r.id === q.blockedBy);
    if (blocker && !ENDED.has(blocker.status)) {
      return { ...item, step: QUEUED, text: `QUEUED: ${item.ticket} waits behind in-flight worker ${q.blockedBy} (brief held as ${q.id})` };
    }
    return { ...item, step: DISPATCH_QUEUED, text: `HELD BRIEF: ${item.ticket} was queued behind ${q.blockedBy}, which has ended. Held brief (${q.id}): ${String(q.brief).slice(0, BRIEF_SHOWN)}. It may be stale or superseded: the maintainer decides whether it runs` };
  });
}
