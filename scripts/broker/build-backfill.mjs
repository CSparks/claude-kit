// build-backfill.mjs — which waiting build may take cores now (KIT-T1280). Pure.
//
// The queue is first come, first served, with one amendment: a build behind a waiting one starts when it fits in the free cores
// and the ones ahead of it do not, so a 2-core test never idles behind a 24-core build that has to wait for a long hold. Only
// the first build in queue order that fits starts, so two waiters never start on the same free cores. The amendment is
// bounded: a build that has waited BYPASS_MAX_MS cannot be passed any more, and from then on the queue is strict, so a large
// build waits for the cores it needs at most BYPASS_MAX_MS plus the holds already running.
//
//   mayStart({ name, queue, now }) -> true when `name` is the first ticket of `queue` that fits and no ticket ahead of it has
//     waited BYPASS_MAX_MS
//     queue: [{ name, fits }] in queue order, `fits` = the build would be granted cores now; a ticket name starts with its
//            arrival time in ms (build-slot.mjs)
//   arrivalMs(name) -> when the ticket was taken

export const BYPASS_MAX_MS = 3 * 60000;
const ARRIVAL_DIGITS = 15;

export const arrivalMs = (name) => Number(String(name).slice(0, ARRIVAL_DIGITS));

export function mayStart({ name, queue, now = Date.now() }) {
  const first = queue.findIndex((t) => t.fits);
  if (first < 0 || queue[first].name !== name) return false;
  return queue.slice(0, first).every((t) => now - arrivalMs(t.name) < BYPASS_MAX_MS);
}
