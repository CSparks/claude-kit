// land.mjs — land a green patch on main (KIT-T276): commit by explicit paths only (never -a or
// -A, so nothing a hand-driven writer left in the tree rides along), push, and for a
// submodule repo pin the superproject to the new sha.

import { join } from 'node:path';
import { git, push, revParse } from './git.mjs';
import { repinSuperproject } from './submodule.mjs';

const normalize = (p) => String(p).replace(/\\/g, '/').replace(/\/$/, '') || '.';

/**
 * Commit `paths` in `cwd`, push `repo.main`, re-pin a submodule's superproject.
 * Returns { ok, committed, sha, superSha, error }; `committed` is true once the commit exists,
 * so the caller knows the tree already matches HEAD even when the push failed.
 */
export function landPatch(cfg, repo, job, cwd, paths) {
  const add = git(['add', '--', ...paths], cwd);
  if (add.code !== 0) return { ok: false, committed: false, error: `git add: ${add.err}` };
  const message = `${job.title || `patch ${job.id}`} (implements ${job.ticket})`;
  const commit = git(['commit', '-m', message, '--', ...paths], cwd);
  if (commit.code !== 0) {
    git(['reset', '-q', '--', ...paths], cwd);
    return { ok: false, committed: false, error: `git commit: ${commit.err}` };
  }
  const sha = revParse(cwd, 'HEAD');
  const pushed = push(cwd, repo.remote, repo.main);
  if (!pushed.ok) return { ok: false, committed: true, sha, error: `committed ${sha} locally; push ${repo.remote} ${repo.main} failed: ${pushed.err}` };
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
