// framework-pin/forecast.mjs — will bringing origin/main into the submodule collide with what is there? Decided
// without touching the tree: path overlaps come from the diff of gitlink..origin/main, and the local-commit merge is
// tried by `git merge-tree --write-tree`, which writes only objects.
//
//   forecastConflicts(subCwd, state) -> { overlaps[], collisions[], merge: 'clean' | 'conflicts' | 'unknown' | 'none', mergeFiles[] }
//     overlaps    locally edited tracked paths that origin/main also changes
//     collisions  untracked paths that origin/main adds as tracked files
//     merge       none when there are no local commits to merge; unknown when git cannot tell (git before 2.38)

import { spawnSync } from 'node:child_process';
import { git } from '../exec.mjs';

const NUL = String.fromCharCode(0);
const MERGE_CLEAN = 0;
const MERGE_CONFLICTS = 1;

const changedPaths = (sub, gitlink, origin, ...flags) =>
  new Set(git(['--no-optional-locks', '-C', sub, 'diff', '--name-only', '-z', ...flags, gitlink, origin]).split(NUL).filter(Boolean));

function mergeVerdict(sub, origin) {
  const r = spawnSync('git', ['--no-optional-locks', '-C', sub, 'merge-tree', '--write-tree', '--name-only', origin, 'HEAD'], { encoding: 'utf8', windowsHide: true });
  if (r.status === MERGE_CLEAN) return { merge: 'clean', mergeFiles: [] };
  if (r.status !== MERGE_CONFLICTS) return { merge: 'unknown', mergeFiles: [] };
  const [, ...paths] = String(r.stdout).split('\n\n')[0].split('\n');
  return { merge: 'conflicts', mergeFiles: paths.filter(Boolean) };
}

export function forecastConflicts(subCwd, state) {
  const none = { overlaps: [], collisions: [], merge: 'none', mergeFiles: [] };
  if (!state.origin || !state.gitlinkKnown) return none;
  const changed = changedPaths(subCwd, state.gitlink, state.origin);
  const added = changedPaths(subCwd, state.gitlink, state.origin, '--diff-filter=A');
  return {
    ...none,
    overlaps: state.trackedEdits.filter((p) => changed.has(p)),
    collisions: state.untracked.filter((p) => added.has(p)),
    ...(state.localCommits.length ? mergeVerdict(subCwd, state.origin) : {}),
  };
}
