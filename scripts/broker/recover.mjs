// recover.mjs — the start-up restore of a crashed run's journal, under the submodule tree lock
// (KIT-T552). The journal's pre-images are written into the checkout the dead run used; if the
// other lane holds that tree by now (subtree.mjs) the restore waits, so it never writes into a
// checkout another job is building.
//
// `recoverUnderLock(cfg, say)` -> { done: true } | { done: false, reason }. Nothing to recover is done.
//   `say(line)` receives the one-line outcome. A journal past its landing commit is finished
//   (resume.mjs) under the same lock.

import { readInflight, recoverInflight } from './preimage.mjs';
import { resumeLanding } from './resume.mjs';
import { journalSubtrees, takeSubtrees } from './subtree.mjs';

export function recoverUnderLock(cfg, say) {
  const journal = readInflight(cfg);
  if (!journal) return { done: true };
  const tree = takeSubtrees(cfg, journalSubtrees(cfg, journal), `recover-${journal.id}`, { reattach: false });
  if (!tree.ok) return { done: false, reason: `restore of ${journal.id} waits: ${tree.reason}` };
  try {
    const recovered = recoverInflight(cfg);
    if (recovered && recovered.resume) {
      say(`broker: ${recovered.id} stopped after its commit; finishing the landing (the tree stays at the commit)`);
      for (const r of resumeLanding(cfg, recovered.resume)) say(`  ${r.id} → ${r.status}`);
    } else if (recovered) say(`broker: restored the tree after interrupted job ${recovered.id}; it re-runs`);
  } finally { tree.release(); }
  return { done: true };
}
