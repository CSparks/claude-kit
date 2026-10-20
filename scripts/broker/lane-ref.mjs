// lane-ref.mjs — the commit a submodule lane will run a job on. Between jobs the lane's tree can sit
// detached at the superproject's pin while its branch is ahead (an earlier landing); the daemon fast-
// forwards the tree onto the branch before the next job (subtree.mjs reattachBranch). A submit that
// reads the detached HEAD would report files the previous landing changed as stale, so the dry run
// reads the commit the daemon will use.
//
//   laneRef(repo, cwd) -> 'HEAD' | the repo's branch name (a submodule whose detached HEAD is an ancestor of it)

import { git } from './git.mjs';

export function laneRef(repo, cwd) {
  if (!repo.submodule || git(['symbolic-ref', '-q', 'HEAD'], cwd).code === 0) return 'HEAD';
  if (git(['rev-parse', '--verify', '-q', `refs/heads/${repo.main}`], cwd).code !== 0) return 'HEAD';
  return git(['merge-base', '--is-ancestor', 'HEAD', repo.main], cwd).code === 0 ? repo.main : 'HEAD';
}
