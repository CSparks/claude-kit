// sync-push.mjs — push the local branch after bringing it up to date with the remote (KIT-T319).
// A remote that moved since the job started is fetched and the local commits are rebased onto it
// (autostash keeps a hand-driven writer's uncommitted edits). A rebase that cannot apply cleanly
// is aborted, which restores the tree, and the files are reported as a conflict.
//
// `syncPush(cwd, remote, branch, { verify })` -> { ok, rebased, conflict?, verifyFailed?, error? }
//   verify(incoming) runs the caller's tests after a rebase that pulled in non-doc files and
//   returns { ok }; it is skipped when only documentation arrived. beforePush() runs right before
//   each push attempt and returns { ok, error }; a refusal ends the sync (gateRefused). env goes to
//   git push, so the repo's pre-push hook sees it.

import { dirtyPaths, git, push } from './git.mjs';

const MAX_ATTEMPTS = 3;
const DOCS_ONLY = /\.(?:md|txt)$/i;

const lines = (out) => (out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : []);

export function syncPush(cwd, remote, branch, { verify, env, beforePush, onPhase = () => {} } = {}) {
  let rebased = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const fetched = git(['fetch', remote, branch], cwd);
    const tip = `${remote}/${branch}`;
    const behind = fetched.code === 0 ? Number(git(['rev-list', '--count', `HEAD..${tip}`], cwd).out) : 0;
    if (behind > 0) {
      const incoming = lines(git(['diff', '--name-only', `HEAD...${tip}`], cwd).out);
      const dirty = new Set(dirtyPaths(cwd));
      const overlap = incoming.filter((p) => dirty.has(p));
      if (overlap.length) return { ok: false, rebased, conflict: overlap, error: `${tip} changed files with uncommitted edits: ${overlap.join(', ')}` };
      onPhase('rebase');
      const rebase = git(['rebase', '--autostash', tip], cwd);
      if (rebase.code !== 0) {
        const unmerged = lines(git(['diff', '--name-only', '--diff-filter=U'], cwd).out);
        git(['rebase', '--abort'], cwd);
        return { ok: false, rebased, conflict: unmerged.length ? unmerged : incoming, error: `rebase onto ${tip} conflicted: ${rebase.err.trim().slice(0, 300)}` };
      }
      rebased = true;
      if (verify && !incoming.every((p) => DOCS_ONLY.test(p)) && (onPhase('reverify'), !verify(incoming).ok)) {
        return { ok: false, rebased, verifyFailed: true, error: `rebased onto ${tip}, but the job's tests fail on the rebased tree; the commit stays local` };
      }
    }
    if (beforePush) {
      onPhase('pre-push gate');
      const gate = beforePush();
      if (!gate.ok) return { ok: false, rebased, gateRefused: true, error: gate.error };
    }
    onPhase('push');
    const pushed = push(cwd, remote, branch, env);
    if (pushed.ok) return { ok: true, rebased };
    if (attempt === MAX_ATTEMPTS - 1) return { ok: false, rebased, error: pushed.err };
  }
  return { ok: false, rebased, error: 'push did not complete' };
}
