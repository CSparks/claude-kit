// prior-work.mjs — earlier uncommitted work older than a day (KIT-T1553): untracked source files and stashes, each with its
// age. A session that never reads them builds the same mechanism a second time.
//
//   priorWorkSection(ctx) -> pushes the block onto ctx.out; silent when nothing is that old

import { priorWork, priorWorkLines } from '../prior-work.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export function priorWorkSection({ out, root }) {
  try {
    const found = priorWork(root, { minAgeMs: DAY_MS });
    if (!found.untracked.length && !found.stashes.length) return;
    out.push('', '--- EARLIER UNCOMMITTED WORK (older than a day) ---');
    out.push(...priorWorkLines(found));
    out.push('  Read each before building beside it: use it, merge it, or report it. Never build the same rule again.');
  } catch {
    /* the section is best-effort */
  }
}
