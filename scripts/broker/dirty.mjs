// dirty.mjs — a lane paused on a dirty checkout (KIT-T552 C). admit.mjs refuses a job while a
// hand-driven writer's changes sit in the tree; the job stays queued and the lane is paused. Taking the
// submodule tree lock (subtree.mjs) for every poll just to find that out would hand the lock back and
// forth with the other lane, so the first refusal leaves a marker and later polls re-check the tree
// without the lock until it is clean.
//
//   dirtState(cfg, repo, cwd, touched) -> checkoutState of the repo and of the submodules `touched` paths reach into
//   holdDirty(cfg, job, repo)          record the refusal (touched = the job's paths)
//   dirtyHold(cfg, repo)               -> true while the marked tree is still dirty; a clean one drops the marker
//   pausedOnDirt(laneCfg, repo)        -> same, for another lane's marker (idle work asks before it takes the tree)

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivedUntrackedBlocks } from './blocks.mjs';
import { brokerPaths } from './config.mjs';
import { dirtyBlocksOf } from './build-inputs.mjs';
import { checkoutState, git, revParse } from './git.mjs';
import { splitLinked } from './linked.mjs';
import { healOwnDirt } from './written.mjs';

const posix = (p) => String(p).replace(/\\/g, '/');
const markerOf = (cfg) => join(brokerPaths(cfg).home, 'dirty-hold.json');

// A submodule lane's own tree detached at commits on neither its branch nor the remote's: moving it
// onto the branch would orphan them, so the lane pauses naming the sha (KIT-D097).
function detachedWork(cfg, repo, cwd) {
  if (!repo.submodule || cfg.lane !== repo.name) return null;
  if (git(['symbolic-ref', '-q', 'HEAD'], cwd).code === 0) return null;
  const head = revParse(cwd, 'HEAD');
  const reachable = [repo.main, `${repo.remote}/${repo.main}`].some((ref) => git(['merge-base', '--is-ancestor', 'HEAD', ref], cwd).code === 0);
  return head && !reachable ? `${repo.path} is detached at ${head}, which is on neither ${repo.main} nor ${repo.remote}/${repo.main}; the lane waits so those commits are not orphaned` : null;
}

export function dirtState(cfg, repo, cwd, touched) {
  for (const p of healOwnDirt(cfg, cwd)) console.error(`broker: put ${p} back from HEAD: only its line endings differed after a broker job wrote it`);
  const untrackedBlocks = (cfg.untrackedDerived && derivedUntrackedBlocks(cwd)) || cfg.untrackedBlocks;
  const { own, subs } = splitLinked(cfg, repo, touched);
  const state = checkoutState(cwd, { untrackedBlocks, dirtyBlocks: dirtyBlocksOf(cfg, cwd), touched: own });
  const detached = detachedWork(cfg, repo, cwd);
  if (detached) { state.clean = false; state.entries = [...(state.entries || []), detached]; }
  for (const [sub, rels] of subs) {
    const side = checkoutState(join(cfg.root, sub.path), { untrackedBlocks: [], dirtyBlocks: dirtyBlocksOf(cfg, join(cfg.root, sub.path)), touched: rels });
    if (!side.clean) { state.clean = false; state.entries = [...(state.entries || []), ...side.entries.map((e) => `${sub.path}: ${e}`)]; }
  }
  return state;
}

export function holdDirty(cfg, job, repo) {
  try { writeFileSync(markerOf(cfg), JSON.stringify({ id: job.id, repo: repo.name, touched: (job.ops || []).map((o) => posix(o.path)) })); } catch { /* best effort: without it the lane just re-asks */ }
}

/** True while `repo`'s tree is still dirty for the job the marker names. */
export function dirtyHold(cfg, repo) {
  const file = markerOf(cfg);
  if (!existsSync(file)) return false;
  let mark;
  try { mark = JSON.parse(readFileSync(file, 'utf8')); } catch { rmSync(file, { force: true }); return false; }
  if (mark.repo !== repo.name) return false;
  if (!dirtState(cfg, repo, join(cfg.root, repo.path), mark.touched || []).clean) return true;
  rmSync(file, { force: true });
  return false;
}

export const pausedOnDirt = dirtyHold;
