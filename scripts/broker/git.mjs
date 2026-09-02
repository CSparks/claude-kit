// git.mjs — the broker's git primitives, run against a named checkout (the build checkout or a
// submodule path). Dependency-free: every call is `spawnSync('git', args, { cwd })`.
//
// KEY DECISION (KIT-T270): a worker's `lane/*` branch is checked out in that worker's live
// worktree, so the build checkout CANNOT `git switch <branch>` to it — git refuses a branch
// already checked out elsewhere. The broker therefore verifies via a DETACHED checkout of the
// branch tip (`git switch --detach <branch>`), which attaches HEAD to the commit, not the
// branch, and so never collides with the worktree that holds it. Rebase runs detached; a green
// land fast-forwards main to the rebased tip.

import { spawnSync } from 'node:child_process';

// Run a git subcommand; returns { code, out, err }. Never throws.
export function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { code: r.status == null ? 1 : r.status, out: (r.stdout || '').trim(), err: (r.stdout || '') + (r.stderr || '') };
}

// Working-tree cleanliness: modified tracked OR untracked files both count as dirty, so a
// hand-driven writer's in-progress edits pause the broker rather than being built mid-flight.
export function checkoutState(cwd) {
  const r = git(['status', '--porcelain'], cwd);
  const entries = r.out ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  return { clean: r.code === 0 && entries.length === 0, entries };
}

export function revParse(cwd, ref) {
  const r = git(['rev-parse', ref], cwd);
  return r.code === 0 ? r.out : '';
}

export function currentBranch(cwd) {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  return r.code === 0 ? r.out : '';
}

// Detached checkout of a branch tip — see the KEY DECISION header.
export function checkoutDetached(cwd, ref) {
  const r = git(['switch', '--detach', ref], cwd);
  return { ok: r.code === 0, err: r.err };
}

export function switchTo(cwd, branch) {
  const r = git(['switch', branch], cwd);
  return { ok: r.code === 0, err: r.err };
}

// Rebase the detached HEAD onto `onto` (main). On conflict: collect the unmerged paths, abort,
// and report — the caller bounces the job so a worker can rebase locally and resubmit.
export function rebaseOnto(cwd, onto) {
  const r = git(['rebase', onto], cwd);
  if (r.code === 0) return { ok: true, conflicts: [], tip: revParse(cwd, 'HEAD') };
  const conflicts = unmergedFiles(cwd);
  git(['rebase', '--abort'], cwd);
  return { ok: false, conflicts, err: r.err };
}

export function unmergedFiles(cwd) {
  const r = git(['diff', '--name-only', '--diff-filter=U'], cwd);
  return r.code === 0 && r.out ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

// Fast-forward main to a verified rebased tip, then push. ff-only guarantees a linear history:
// it refuses (and reports) if main is not an ancestor of the tip, so nothing is ever silently
// force-merged.
export function mergeFfOnly(cwd, main, tipRef) {
  const sw = git(['switch', main], cwd);
  if (sw.code !== 0) return { ok: false, err: sw.err };
  const m = git(['merge', '--ff-only', tipRef], cwd);
  if (m.code !== 0) return { ok: false, err: m.err };
  return { ok: true, sha: revParse(cwd, 'HEAD') };
}

export function push(cwd, remote, branch) {
  const r = git(['push', remote, branch], cwd);
  return { ok: r.code === 0, err: r.err };
}

// Best-effort branch delete. A branch still held by a live worktree cannot be deleted; the
// caller treats that as retained-for-worker-teardown, not a failure.
export function deleteBranch(cwd, branch) {
  const r = git(['branch', '-D', branch], cwd);
  return { ok: r.code === 0, err: r.err };
}

// Remove a worktree (force, since it may hold committed-but-unpushed state the broker just
// landed). Used on a green land to free the worker's branch for deletion.
export function removeWorktree(cwd, path) {
  const r = git(['worktree', 'remove', '--force', path], cwd);
  return { ok: r.code === 0, err: r.err };
}

// The staged pathspecs — used by the submodule re-pin to assert nothing but the pointer is staged.
export function stagedPaths(cwd) {
  const r = git(['diff', '--cached', '--name-only'], cwd);
  return r.code === 0 && r.out ? r.out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}
