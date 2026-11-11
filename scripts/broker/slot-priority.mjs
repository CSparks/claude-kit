// slot-priority.mjs — what a broker daemon tells the build slot about itself (KIT-T1044). The daemon registers its
// checkout `group` and a `wanted()` probe: true while another lane of that checkout waits for a tree this daemon holds.
// A build slot ticket written by this process carries both, so slot-order.mjs can put the holder's builds first.
//
//   setSlotPriority({ group, wanted })   register (the daemon, once)
//   slotPriority() -> { group, priority } | null   null in any process that registered nothing

let source = null;

export const setSlotPriority = (next) => { source = next; };

export function slotPriority() {
  if (!source) return null;
  let priority = false;
  try { priority = !!source.wanted(); } catch { /* a failing probe means no priority */ }
  return { group: source.group, priority };
}
