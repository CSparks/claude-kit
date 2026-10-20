// restore.mjs — put tracked build debris back from HEAD without a hand `git checkout`. A job killed
// mid-run can leave `Cargo.lock` rewritten (a new entry cargo added); the pin step then refuses the
// submodule as "has uncommitted changes". Two safe cases are restored: a checkout whose ONLY tracked
// changes are Cargo.lock files (cargo regenerates them), and a path a broker job wrote (the ledger).
// Any other tracked edit is somebody's work and stays.
//
//   runningJob(cfg)                 -> id of the job a live daemon is running in this lane, or null
//   restoreLockDebris(cwd)          -> restored paths; none unless every tracked change is a Cargo.lock
//   restorePaths(cfg, paths)        -> { restored: [], refused: [{ path, reason }] }  (paths relative to the root checkout)
//   restoreAllDebris(cfg)           -> [{ repo, path }] restored across the root and every submodule

import { isAbsolute, join, relative, resolve } from 'node:path';
import { git, trackedModifications } from './git.mjs';
import { liveHolder } from './lock.mjs';
import { readInflight } from './preimage.mjs';
import { readResult } from './result.mjs';
import { wasWrittenByBroker } from './written.mjs';

const isLockfile = (path) => /(?:^|[\\/])Cargo\.lock$/.test(path);
const posix = (p) => String(p).split(String.fromCharCode(92)).join('/');

/** The id of the job a live daemon is running in this lane (one without a final result yet), or null. */
export function runningJob(cfg) {
  const inflight = readInflight(cfg);
  if (!inflight || !liveHolder(cfg)) return null;
  const ids = (inflight.members || []).length ? inflight.members : [inflight.id];
  return ids.find((id) => !readResult(cfg, id)) || null;
}

export function restoreLockDebris(cwd) {
  const mods = trackedModifications(cwd).records;
  if (!mods.length || mods.some((m) => !isLockfile(m.path))) return [];
  return mods.filter((m) => git(['checkout', '-q', 'HEAD', '--', m.path], cwd).code === 0).map((m) => m.path);
}

// The repo (root or submodule) whose directory holds `path`, with the path inside it.
function repoOf(cfg, path) {
  const rel = posix(isAbsolute(path) ? relative(cfg.root, path) : path).replace(/^\.\//, '');
  const sub = cfg.repos
    .filter((r) => r.submodule && (rel === posix(r.path) || rel.startsWith(`${posix(r.path).replace(/\/$/, '')}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return sub ? { repo: sub, cwd: join(cfg.root, sub.path), inside: rel.slice(posix(sub.path).length + 1) } : { repo: null, cwd: resolve(cfg.root), inside: rel };
}

export function restorePaths(cfg, paths) {
  const restored = [];
  const refused = [];
  for (const p of paths) {
    const { cwd, inside } = repoOf(cfg, p);
    const modified = trackedModifications(cwd).records.some((m) => posix(m.path) === inside);
    if (!modified) refused.push({ path: p, reason: 'not a modified tracked file' });
    else if (!isLockfile(inside) && !wasWrittenByBroker(cfg, cwd, inside)) refused.push({ path: p, reason: 'changed by hand, not by a broker job; commit or revert it yourself' });
    else if (git(['checkout', '-q', 'HEAD', '--', inside], cwd).code !== 0) refused.push({ path: p, reason: 'git checkout failed' });
    else restored.push(p);
  }
  return { restored, refused };
}

export function restoreAllDebris(cfg) {
  const out = [];
  for (const repo of cfg.repos) {
    const cwd = join(cfg.root, repo.path);
    for (const path of restoreLockDebris(cwd)) out.push({ repo: repo.name, path });
  }
  return out;
}
