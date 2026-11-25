// inherited-files.mjs — a successor agent stashes the work it was handed (KIT-T1565). A writer that was briefed into a set of
// paths ([paths:] of its dispatch, kept on its roster row) inherits the uncommitted files in them that only ended agents wrote;
// the stash-only-your-files baseline needs those files to count as its own.
//
//   inheritedRefusal(root, rel, caller) -> '' when `caller` may take `rel` as inherited, else the other-writer refusal
//     Lifted only when: the caller is a subagent whose roster row declares paths that cover `rel` (an unknown or `*` path list never
//     covers), every other writer whose Edit or Write left the bytes on disk is a subagent whose roster row is ended, and no
//     other live writer holds the file (a claim, a live session's dirty ledger). A main-thread writer, a writer without a roster
//     row, an unreadable roster or registry keeps the refusal.

import { DELETE_REFUSALS as R } from './owns-untracked-file.mjs';
import { AGENT_TERMINAL, readAgents } from './agent-roster.mjs';
import { fileHolders } from './live-writers.mjs';
import { overlaps } from './path-overlap.mjs';
import { toolWriteEntries } from './tool-write-ledger.mjs';
import { contentHashVariants, sameWriterId, writerAgent } from './tool-writes.mjs';

const ALL_PATHS = '*';
const NO_TAIL_LIMIT = Infinity;

const coversFile = (paths, rel) => Array.isArray(paths) && paths.length > 0 && !paths.includes(ALL_PATHS) && overlaps(paths, [rel]);

export function inheritedRefusal(root, rel, caller) {
  try {
    const agent = writerAgent(caller);
    if (!agent) return R.otherWriter;
    const rows = readAgents(root, NO_TAIL_LIMIT, { reconcile: false });
    const mine = rows.find((r) => r.id === agent);
    if (!mine || !coversFile(mine.paths, rel)) return R.otherWriter;
    const hashes = contentHashVariants(root, rel);
    const writers = [...new Set(toolWriteEntries(root, rel).filter((e) => e.w && hashes.includes(e.h) && !sameWriterId(e.w, caller)).map((e) => e.w))];
    const ended = (w) => AGENT_TERMINAL.has(rows.find((r) => r.id === writerAgent(w))?.status);
    if (!writers.length || !writers.every((w) => writerAgent(w) && ended(w))) return R.otherWriter;
    return fileHolders(root, rel, caller).length ? R.otherWriter : '';
  } catch {
    return R.otherWriter;
  }
}
