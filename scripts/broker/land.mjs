// land.mjs — land a green patch on main (KIT-T276): commit by explicit paths only (never -a or
// -A, so nothing a hand-driven writer left in the tree rides along), push, and for a
// submodule repo pin the superproject to the new sha.

import { join } from 'node:path';
import { git, revParse } from './git.mjs';
import { syncPush } from './sync-push.mjs';
import { repinSuperproject } from './submodule.mjs';

const normalize = (p) => String(p).replace(/\\/g, '/').replace(/\/$/, '') || '.';

/**
 * Commit `paths` in `cwd`, push `repo.main`, re-pin a submodule's superproject.
 * A remote that moved is fetched and the commit rebased onto it first (sync-push.mjs); `verify`
 * re-runs the job's tests after such a rebase. Returns { ok, committed, sha, superSha, conflict,
 * error }; `committed` is true while the commit exists locally, so the caller knows the tree
 * already matches HEAD even when the push failed. A conflicting rebase drops the local commit
 * (`committed` false, `conflict` names the files) and leaves the working files for the caller to restore.
 */
export function landPatch(cfg, repo, job, cwd, paths, { verify } = {}) {
  const preHead = revParse(cwd, 'HEAD');
  const add = git(['add', '--', ...paths], cwd);
  if (add.code !== 0) return { ok: false, committed: false, error: `git add: ${add.err}` };
  const message = `${job.title || `patch ${job.id}`} (implements ${job.ticket})`;
  const commit = git(['commit', '-m', message, '--', ...paths], cwd);
  if (commit.code !== 0) {
    git(['reset', '-q', '--', ...paths], cwd);
    return { ok: false, committed: false, error: `git commit: ${commit.err}` };
  }
  const pushed = syncPush(cwd, repo.remote, repo.main, { verify });
  if (pushed.conflict) {
    git(['reset', '-q', '--mixed', preHead], cwd);
    return { ok: false, committed: false, conflict: pushed.conflict, error: pushed.error };
  }
  const sha = revParse(cwd, 'HEAD');
  if (!pushed.ok) return { ok: false, committed: true, sha, error: pushed.verifyFailed ? pushed.error : `committed ${sha} locally; push ${repo.remote} ${repo.main} failed: ${pushed.error}` };
  if (!repo.submodule) return { ok: true, committed: true, sha, superSha: null };

  const superRepo = cfg.repos.find((r) => !r.submodule && normalize(r.path) === normalize(repo.pinIn));
  const superRoot = join(cfg.root, repo.pinIn);
  const pin = repinSuperproject({
    superRoot, subPath: repo.path, remote: superRepo ? superRepo.remote : repo.remote, main: superRepo ? superRepo.main : 'main',
    sha, ticket: job.ticket, title: job.title || repo.path,
  });
  if (!pin.ok) return { ok: false, committed: true, sha, error: `landed ${sha} in ${repo.path}; superproject pin failed: ${pin.error}` };
  return { ok: true, committed: true, sha, superSha: revParse(superRoot, 'HEAD') };
}
