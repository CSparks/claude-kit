// pin.mjs — submodule pins on a superproject job (KIT-T320). `--pin rapid-game=<sha>` makes the
// job build and test with that submodule checked out at <sha>, and a landing commits the gitlink
// together with the patch paths in one commit. The submodule's previous checkout comes back after
// a check-only or failed run; after a landing it returns to its branch (fast-forwarded to <sha>).
//
//   parsePins(cfg, repo, flags)   -> { pins: [{ repo, path, sha }] } | { error }   (submit time)
//   preparePins(cfg, cwd, job)    -> { pins: [session] } | { error }               (run time)
//   checkoutPins / revertPins / settlePins(pins)                                    checkout control
//   shaOnRemote(cwd, remote, main, sha)                                            pushed to origin?

import { join } from 'node:path';
import { asList } from './cli.mjs';
import { repoByName } from './config.mjs';
import { dirtyPaths, git, revParse } from './git.mjs';

const SHA = /^[0-9a-f]{7,40}$/i;

/** True when `sha` is reachable from `<remote>/<main>` after a fetch. */
export function shaOnRemote(cwd, remote, main, sha) {
  git(['fetch', remote, main], cwd);
  return git(['merge-base', '--is-ancestor', sha, `${remote}/${main}`], cwd).code === 0;
}

const subRepo = (cfg, name, superRepo) => {
  const sub = repoByName(cfg, name);
  return sub && sub.submodule && String(sub.pinIn || '.') === String(superRepo.path) ? sub : null;
};

/** Validate `--pin name=sha` flags for a job on `superRepo`; a landing needs each sha pushed. */
export function parsePins(cfg, superRepo, flags) {
  const pins = [];
  for (const raw of asList(flags.pin).map(String)) {
    const [name, sha] = raw.split('=');
    const sub = subRepo(cfg, name, superRepo);
    if (!sub) return { error: `--pin ${raw}: ${name || '(no name)'} is not a submodule of ${superRepo.name}` };
    if (!SHA.test(sha || '')) return { error: `--pin ${raw}: expected <submodule>=<sha>` };
    const cwd = join(cfg.root, sub.path);
    const full = git(['rev-parse', '--verify', `${sha}^{commit}`], cwd);
    if (full.code !== 0) return { error: `--pin ${raw}: ${sha} is not a commit in ${sub.path}` };
    if (flags.land && !shaOnRemote(cwd, sub.remote, sub.main, full.out)) {
      return { error: `--pin ${raw}: ${full.out.slice(0, 10)} is not on ${sub.remote}/${sub.main}; push the submodule commit first (a landing never pins an unpushed sha)` };
    }
    pins.push({ repo: sub.name, path: sub.path, sha: full.out });
  }
  return { pins };
}

/** Run-time sessions for `job.pins`: the submodule must be clean; a landing re-checks the remote. */
export function preparePins(cfg, cwd, job) {
  const sessions = [];
  for (const pin of job.pins || []) {
    const sub = repoByName(cfg, pin.repo);
    if (!sub) return { error: `pin: unknown repo '${pin.repo}'` };
    const subCwd = join(cfg.root, sub.path);
    if (dirtyPaths(subCwd).length) return { error: `pin: ${sub.path} has uncommitted changes` };
    if (git(['cat-file', '-e', `${pin.sha}^{commit}`], subCwd).code !== 0) return { error: `pin: ${pin.sha} is not a commit in ${sub.path}` };
    if (job.land && !shaOnRemote(subCwd, sub.remote, sub.main, pin.sha)) return { error: `pin: ${pin.sha.slice(0, 10)} is not on ${sub.remote}/${sub.main}; a landing never pins an unpushed sha` };
    const branch = git(['symbolic-ref', '-q', '--short', 'HEAD'], subCwd).out;
    sessions.push({ ...pin, sub, cwd: subCwd, prevBranch: branch || null, prevSha: revParse(subCwd, 'HEAD') });
  }
  return { pins: sessions };
}

export function checkoutPins(pins) {
  for (const p of pins) git(['checkout', '-q', '--detach', p.sha], p.cwd);
}

/** Put each submodule back where it was before the job. */
export function revertPins(pins) {
  for (const p of pins) git(p.prevBranch ? ['checkout', '-q', p.prevBranch] : ['checkout', '-q', '--detach', p.prevSha], p.cwd);
}

/** After a landing: back on the submodule's branch, fast-forwarded to the pinned sha when possible. */
export function settlePins(pins) {
  for (const p of pins) {
    const branch = p.prevBranch || p.sub.main;
    const on = git(['checkout', '-q', branch], p.cwd).code === 0;
    if (!on || git(['merge', '-q', '--ff-only', p.sha], p.cwd).code !== 0) git(['checkout', '-q', '--detach', p.sha], p.cwd);
  }
}
