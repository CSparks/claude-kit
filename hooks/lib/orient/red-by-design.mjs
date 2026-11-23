// red-by-design (orient) — named-debt tests older than STALE_DAYS (lib/red-by-design.mjs), listed so a red test the
// red-test-dispatch gate exempts is built or renewed and never rots.
//
//   staleEntries(root, now?)   -> [{ test, decidedBy, owner, ageDays }] oldest first
//   staleLines(items)          -> the orient block, [] when nothing is stale
//   redByDesignSection({ out, root })   pushes the block; best-effort

import { STALE_DAYS, ageDays, readEntries } from '../red-by-design.mjs';

const SHOWN = 8;

export const STALE_HEADER = `--- RED BY DESIGN, OVER ${STALE_DAYS} DAYS (named-debt tests the red-test gate exempts; raise each to the maintainer: sign the fix or keep it red) ---`;

export function staleEntries(root, now = Date.now()) {
  return readEntries(root)
    .map((e) => ({ test: e.test, decidedBy: e.decidedBy, owner: e.owner, ageDays: ageDays(e, now) }))
    .filter((e) => Number.isFinite(e.ageDays) && e.ageDays > STALE_DAYS)
    .sort((a, b) => b.ageDays - a.ageDays);
}

export function staleLines(items) {
  if (!items.length) return [];
  return [
    STALE_HEADER,
    ...items.slice(0, SHOWN).map((e) => `  ${e.test} (${e.ageDays}d) ${e.decidedBy.join(', ')}; fix: ${e.owner}`),
    ...(items.length > SHOWN ? [`  +${items.length - SHOWN} more`] : []),
    '  Only the maintainer renews or clears one. He keeps it red: t red-by-design add <test> --decided-by <id> --reason "<why>" (renews the date). Fixed or ruled green: t red-by-design remove <test>.',
    '',
  ];
}

export function redByDesignSection({ out, root }) {
  try {
    out.push(...staleLines(staleEntries(root)));
  } catch {
    /* orientation proceeds without the block */
  }
}
