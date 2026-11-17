// restore-tree/plan.mjs — what putting a set of directories back to a revision does, decided without touching the disk.
//
//   planRestore({ target, disk, tracked, matchesTarget, recoverable }) -> { write, remove, leave, refuse }
//     target         Map path -> blob id of the regular files the revision holds inside the directories
//     disk           Set of the paths that exist on disk inside the directories
//     tracked        Set of the paths git tracks (index or HEAD)
//     matchesTarget  (path) -> the bytes on disk already are the revision's
//     recoverable    Set of the on-disk paths whose bytes HEAD or a reachable commit holds at that path (history-blobs.mjs)
//   write   revision paths to check out (absent on disk, or different and recoverable)
//   remove  paths on disk the revision lacks whose bytes history can give back
//   leave   untracked paths the revision lacks and no commit holds: someone's new work, never touched
//   refuse  [{ path, why }] files a write or delete would destroy because no commit holds their bytes; one refusal stops the run
//
// The invariant: a byte nothing in git could return is never overwritten or removed.

import { posix } from 'node:path';

export const OVERWRITE = 'uncommitted changes would be overwritten';
export const DELETE = 'uncommitted changes would be deleted';
export const STAGED = 'a staged change no commit holds would be discarded';

export function planRestore({ target, disk, tracked, matchesTarget, recoverable }) {
  const plan = { write: [], remove: [], leave: [], refuse: [] };
  for (const path of [...target.keys()].sort()) {
    if (!disk.has(path)) plan.write.push(path);
    else if (matchesTarget(path)) continue;
    else if (recoverable.has(path)) plan.write.push(path);
    else plan.refuse.push({ path, why: OVERWRITE });
  }
  for (const path of [...disk].filter((p) => !target.has(p)).sort()) {
    if (recoverable.has(path)) plan.remove.push(path);
    else if (tracked.has(path)) plan.refuse.push({ path, why: DELETE });
    else plan.leave.push(path);
  }
  return plan;
}

/** The directories a removed path leaves behind, deepest first, each strictly inside one of `roots` (repo-relative, posix). */
export function emptiedParents(removed, roots) {
  const inside = (dir) => roots.some((root) => dir !== root && dir.startsWith(`${root}/`));
  const dirs = new Set();
  for (const path of removed) {
    for (let dir = posix.dirname(path); inside(dir); dir = posix.dirname(dir)) dirs.add(dir);
  }
  return [...dirs].sort((a, b) => b.length - a.length);
}
