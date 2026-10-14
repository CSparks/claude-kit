// land.mjs — land a green patch on main (KIT-T276): commit by explicit paths only (never -a or
// -A, so nothing a hand-driven writer left in the tree rides along), push, and for a
// submodule repo pin the superproject to the new sha.

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { git, revParse } from './git.mjs';
import { syncPush } from './sync-push.mjs';
import { repinSuperproject } from './submodule.mjs';
import { buildEnv, runPrePush } from './prepush.mjs';
import { logPathFor } from './result.mjs';

const normalize = (p) => String(p).replace(/\\/g, '/').replace(/\/$/, '') || '.';

/**
 * Commit `paths` in `cwd`, push `repo.main`, re-pin a submodule's superproject.
 * A remote that moved is fetched and the commit rebased onto it first (sync-push.mjs); `verify`
 * re-runs the job's tests after such a rebase. `trailer` becomes the commit body.
 * Returns { ok, committed, sha, superSha, conflict, error }; `committed` is true while the commit exists locally, so the caller knows the tree
 * already matches HEAD even when the push failed. A conflicting rebase drops the local commit
 * (`committed` false, `conflict` names the files) and leaves the working files for the caller to restore.
 */
// A landing that did not reach the remote leaves no local commit (KIT-T482 item 3): before a rebase
// the commit is undone and the caller restores the files; after one, HEAD goes to the remote tip
// and the patch paths are checked out from it, so the tree already matches HEAD.
function undoLanding(cwd, repo, paths, preHead, pushed) {
  const why = pushed.error;
  if (!pushed.rebased) {
    git(['reset', '-q', '--mixed', preHead], cwd);
    return { ok: false, committed: false, error: `push ${repo.remote} ${repo.main} did not land, commit undone: ${why}` };
  }
  const tip = `${repo.remote}/${repo.main}`;
  git(['reset', '-q', '--mixed', tip], cwd);
  const tracked = new Set(git(['ls-tree', '-r', '--name-only', tip, '--', ...paths], cwd).out.split('\n').filter(Boolean));
  const back = paths.filter((p) => tracked.has(p));
  if (back.length) git(['checkout', tip, '--', ...back], cwd);
  for (const p of paths.filter((x) => !tracked.has(x))) rmSync(join(cwd, p), { force: true });
  return { ok: false, committed: true, sha: revParse(cwd, 'HEAD'), error: `rebased onto ${tip} but did not land, commit undone: ${why}` };
}

export function landPatch(cfg, repo, job, cwd, paths, { verify, trailer, onPhase = () => {} } = {}) {
  onPhase('commit');
  const preHead = revParse(cwd, 'HEAD');
  const add = git(['add', '--', ...paths], cwd);
  if (add.code !== 0) return { ok: false, committed: false, error: `git add: ${add.err}` };
  const title = job.title || `patch ${job.id}`;
  const subject = title.includes(`(implements ${job.ticket})`) ? title : `${title} (implements ${job.ticket})`;
  const message = trailer ? `${subject}\n\n${trailer}` : subject;
  const commit = git(['commit', '-m', message, '--', ...paths], cwd);
  if (commit.code !== 0) {
    git(['reset', '-q', '--', ...paths], cwd);
    return { ok: false, committed: false, error: `git commit: ${commit.err}` };
  }
  const beforePush = repo.prePush ? () => {
    const gate = runPrePush(cfg, cwd, repo.remote, repo.main, logPathFor(cfg, job.id, 'pre-push'));
    return { ok: gate.ok, error: `the repo's pre-push gate refused (exit ${gate.exit}): ${gate.log.slice(-8).join(' | ')}` };
  } : null;
  const pushed = syncPush(cwd, repo.remote, repo.main, { verify, env: buildEnv(cfg), beforePush, onPhase });
  if (pushed.conflict) {
    git(['reset', '-q', '--mixed', preHead], cwd);
    return { ok: false, committed: false, conflict: pushed.conflict, error: pushed.error };
  }
  if (!pushed.ok) return undoLanding(cwd, repo, paths, preHead, pushed);
  const sha = revParse(cwd, 'HEAD');
  if (!repo.submodule || job.noPin) return { ok: true, committed: true, sha, superSha: null };

  onPhase('pin');
  const superRepo = cfg.repos.find((r) => !r.submodule && normalize(r.path) === normalize(repo.pinIn));
  const superRoot = join(cfg.root, repo.pinIn);
  const pin = repinSuperproject({
    superRoot, subPath: repo.path, remote: superRepo ? superRepo.remote : repo.remote, main: superRepo ? superRepo.main : 'main',
    sha, ticket: job.ticket, title: job.title || repo.path,
  });
  if (!pin.ok) return { ok: false, committed: true, sha, error: `landed ${sha} in ${repo.path}; superproject pin failed: ${pin.error}` };
  return { ok: true, committed: true, sha, superSha: revParse(superRoot, 'HEAD') };
}
