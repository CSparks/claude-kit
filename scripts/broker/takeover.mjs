// takeover.mjs — a daemon about to run a job restores what another daemon left half-applied for
// it (KIT-T524). A job can change hands: an old-runtime root daemon ran a submodule job in the root
// home, then the lane daemon of that submodule picked it up and found only the job's own partial
// apply, which blocked it as dirt. The journal naming the job, in any lane's or the root's home
// whose daemon is dead, is the proof the dirt is the job's own: its pre-images go back first.
//
//   takeOverJournal(cfg, jobId) -> { home, restored: [path], failed: [path] } | { busy: reason } | null
//   The restore writes into a submodule tree only while holding its lock (subtree.mjs); busy = another lane holds it.
//   Own home is skipped (recoverInflight handles it at start). A journal past its landing commit, or
//   past a linked job's submodule push, stays for its own daemon (resume.mjs); so does a live daemon's.

import { laneConfigs, brokerPaths } from './config.mjs';
import { liveHolder } from './lock.mjs';
import { journalSubtrees, takeSubtrees } from './subtree.mjs';
import { commitStands, inflightHas, linkedStands, readInflight, restore } from './preimage.mjs';

export function takeOverJournal(cfg, jobId) {
  const mine = brokerPaths(cfg).home;
  for (const lane of laneConfigs(cfg)) {
    if (brokerPaths(lane).home === mine) continue;
    const journal = readInflight(lane);
    if (!inflightHas(journal, jobId) || liveHolder(lane)) continue;
    if (journal.committed || journal.linked || commitStands(journal) || linkedStands(journal)) continue;
    const tree = takeSubtrees(cfg, journalSubtrees(cfg, journal), `takeover-${jobId}`, { reattach: false });
    if (!tree.ok) return { busy: tree.reason };
    try {
      const failed = restore(lane, journal);
      return { home: brokerPaths(lane).home, restored: journal.entries.map((e) => e.path), failed };
    } finally { tree.release(); }
  }
  return null;
}
