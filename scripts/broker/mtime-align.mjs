// mtime-align.mjs — a fresh check-tree worktree must not rebuild the workspace (KIT-D115 follow-up).
// Cargo decides a crate is stale when a source file is newer than its last build output, and a new `git worktree add`
// stamps every file "now": the first build there recompiles every workspace crate (a cold rapid-game build is
// 6-10 minutes) although the code is identical to the live tree the shared target dir was built from.
// Cargo's package hash is relative to the workspace root, so the artifacts are shared; only the mtimes differ.
//
//   alignMtimes(live, tree) -> number of files given the live tree's mtime
//     Each file `git ls-files` lists in `tree` takes the mtime of the same path in `live` when it exists there
//     with the same size and is not modified there; anything else keeps its fresh stamp and rebuilds.

import { statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './git.mjs';

const lines = (r) => (r.code === 0 && r.out ? r.out.split('\0').filter(Boolean) : []);

export function alignMtimes(live, tree) {
  const modified = new Set(lines(git(['diff', '--name-only', '-z', 'HEAD'], live)));
  let aligned = 0;
  for (const path of lines(git(['ls-files', '-z'], tree))) {
    if (modified.has(path)) continue;
    try {
      const from = statSync(join(live, path));
      const to = statSync(join(tree, path));
      if (!from.isFile() || from.size !== to.size) continue;
      utimesSync(join(tree, path), from.atime, from.mtime);
      aligned++;
    } catch { /* absent in the live tree: keeps its stamp */ }
  }
  return aligned;
}
