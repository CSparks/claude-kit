// submodule.mjs — re-pin the superproject to a landed submodule sha with a PATHSPEC-ONLY
// commit. A submodule job (repo: rapid-game) lands inside the submodule; the superproject must
// then record the new pointer WITHOUT sweeping in any other change a hand-driven writer left
// staged. Hence: never `git add -A`, never `git commit -a` — stage only the submodule path,
// assert nothing else rode along, then commit that one pathspec.

import { git, stagedPaths } from './git.mjs';

// Re-pin `subPath` in the superproject at `superRoot`. Returns { ok, sha, error }.
//   - refuses if anything is already staged (a writer's half-made commit would be captured);
//   - stages only `subPath`, then asserts the staged set is exactly {subPath};
//   - commits with a `-- <subPath>` pathspec and the [no-log: submodule pin] marker;
//   - pushes the superproject.
export function repinSuperproject({ superRoot, subPath, remote = 'origin', main = 'main', sha, ticket, title }) {
  const preexisting = stagedPaths(superRoot);
  if (preexisting.length) {
    return { ok: false, error: `superproject has staged changes before re-pin: ${preexisting.join(', ')}` };
  }
  const add = git(['add', subPath, '--', subPath], superRoot);
  if (add.code !== 0) return { ok: false, error: `git add ${subPath} failed: ${add.err}` };

  const staged = stagedPaths(superRoot);
  const stray = staged.filter((p) => normalize(p) !== normalize(subPath));
  if (stray.length) {
    git(['reset', '--', subPath], superRoot);
    return { ok: false, error: `refusing re-pin: extra paths staged: ${stray.join(', ')}` };
  }
  if (!staged.length) {
    // The pointer already matches — nothing to commit, and that is a success, not an error.
    return { ok: true, sha, noop: true };
  }

  const msg = `chore: pin ${subPath} ${sha} — ${title} (implements ${ticket}) [no-log: submodule pin]`;
  const commit = git(['commit', '-m', msg, '--', subPath], superRoot);
  if (commit.code !== 0) return { ok: false, error: `superproject commit failed: ${commit.err}` };

  const pushed = git(['push', remote, main], superRoot);
  if (pushed.code !== 0) return { ok: false, error: `superproject push failed: ${pushed.err}` };
  return { ok: true, sha };
}

function normalize(p) {
  return String(p).replace(/\\/g, '/').replace(/\/$/, '');
}
