// handback-queued.mjs — a successor dispatch the guard queued behind an in-flight worker (KIT-T828, hooks/lib/queued-dispatch.mjs)
// changes the step the reconciler names for its ticket:
//   blocker still in flight -> step 'queued': the obligation is held, so the Stop gate accepts it
//   blocker ended           -> step 'dispatch-queued': the held brief is ready to dispatch now
//
//   applyQueued(root, rows, items) -> items with the steps above for tickets that have a queued row

import { readQueued } from './queued-dispatch.mjs';

export const QUEUED = 'queued';
export const DISPATCH_QUEUED = 'dispatch-queued';
const DISPATCHABLE_STEPS = new Set(['successor', 'fresh-worker']);
const ENDED = new Set(['done', 'error', 'killed', 'stale', 'collected', 'merged']);
const BRIEF_SHOWN = 400;

export function applyQueued(root, rows, items) {
  const queued = readQueued(root);
  if (!queued.length) return items;
  return items.map((item) => {
    const q = item.ticket && DISPATCHABLE_STEPS.has(item.step) ? queued.find((row) => (row.tickets || []).includes(item.ticket)) : null;
    if (!q) return item;
    const blocker = rows.find((r) => r.id === q.blockedBy);
    if (blocker && !ENDED.has(blocker.status)) {
      return { ...item, step: QUEUED, text: `QUEUED: ${item.ticket} waits behind in-flight worker ${q.blockedBy} (brief held as ${q.id}); dispatch it when that worker ends` };
    }
    return { ...item, step: DISPATCH_QUEUED, text: `DISPATCH QUEUED SUCCESSOR NOW: ${item.ticket} was held behind ${q.blockedBy}, which has ended. Held brief (${q.id}): ${String(q.brief).slice(0, BRIEF_SHOWN)}` };
  });
}
