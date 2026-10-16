// subtree.mjs — one owner at a time for a submodule's working tree (KIT-T517). The submodule
// lane edits, builds and commits in that tree; a superproject job pins it at a sha and builds
// the superproject over it. Both lanes' daemons run at once, so each takes a lock file under the
// shared broker home before it touches the tree and releases it when its job ends.
//
//   subtreesFor(cfg, repo, jobs)        -> [submodule repo entries] the jobs need the tree of
//   takeSubtrees(cfg, subs, id, opts)   -> { ok: true, release() } | { ok: false, reason }
//   reclaimStale(cfg, sub)              a dead holder's lock is removed; a superproject holder's
//                                       checkout is put back first
//
// A lane that finds the lock held leaves a "want" mark; the other lane then yields instead of
// retaking the tree straight away, so neither starves the other. Idle work (re-checks, the suite)
// takes the lock too but claims no priority. A superproject holder (`restore`) records the
// submodule's branch or sha at take time, and release puts it back: a pin checkout never
// leaves the submodule detached, even after a hard kill (the next taker reclaims the lock).

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { brokerPaths, withLane } from './config.mjs';
import { reapOrphans } from './children.mjs';
import { dirtyPaths, git, revParse } from './git.mjs';
import { jobCommands } from './job-commands.mjs';

const WANT_FRESH_MS = 30_000;
let taken = 0;
/** Successful lock takes in this process (tests count them to see a lane stop re-asking). */
export const takesSoFar = () => taken;
const CARGO = /(^|[\s;&|])cargo(\s|$)/;
const laneName = (cfg) => cfg.lane || 'root';
const homeOf = (cfg) => join(cfg.targetDir, 'broker', 'subtree');
const lockPath = (cfg, sub) => join(homeOf(cfg), `${sub.name}.lock`);
const wantPath = (cfg, sub, lane) => join(homeOf(cfg), `${sub.name}.want.${lane}`);
const subCwd = (cfg, sub) => join(cfg.root, sub.path);
const posix = (p) => String(p).replace(/\\/g, '/');

const alive = (pid) => {
  if (!Number.isInteger(pid)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === 'EPERM'; }
};
const read = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const liveRecord = (r) => !!r && (r.host !== hostname() || alive(r.pid));

/** Does a job build or edit the submodule's tree: it pins it, edits a path in it, or runs cargo. */
function usesTree(cfg, sub, job) {
  if ((job.pins || []).some((p) => p.repo === sub.name)) return true;
  if (jobCommands(cfg, job).some((c) => CARGO.test(String(c)))) return true;
  const paths = (job.ops || []).map((o) => posix(o.path));
  return paths.some((p) => p === posix(sub.path) || p.startsWith(`${posix(sub.path)}/`));
}

/** The submodules whose tree a lane needs for `jobs` of `repo`: its own, or those a superproject job builds. */
export function subtreesFor(cfg, repo, jobs) {
  if (repo.submodule) return [repo];
  const subs = cfg.repos.filter((r) => r.submodule && String(r.pinIn) === String(repo.path));
  return subs.filter((sub) => jobs.some((j) => usesTree(cfg, sub, j)));
}

/** Every submodule tree a lane's idle work (re-checks, the suite) runs over. */
export function idleSubtrees(cfg) {
  const own = cfg.repos.find((r) => r.submodule && r.name === cfg.lane);
  if (own) return [own];
  return cfg.repos.filter((r) => r.submodule);
}

function headState(cwd) {
  const branch = git(['symbolic-ref', '-q', '--short', 'HEAD'], cwd).out;
  return { branch: branch || null, sha: revParse(cwd, 'HEAD') };
}

/**
 * Put a detached submodule back on `prev`. A checkout on a branch is a job's own settled result
 * (pin.mjs settlePins) and a tree with uncommitted work is not ours to move: both are left alone.
 */
export function restoreHead(cwd, prev) {
  if (!prev || !existsSync(cwd) || dirtyPaths(cwd).length) return false;
  const now = headState(cwd);
  if (now.branch) return true;
  if (prev.branch) return git(['checkout', '-q', prev.branch], cwd).code === 0;
  return now.sha === prev.sha || git(['checkout', '-q', '--detach', prev.sha], cwd).code === 0;
}

/**
 * The submodule lane's own tree before a job: clean and detached at an ancestor of `sub.main`
 * (a superproject pin checkout a crash or an older broker left behind) goes back on the branch,
 * fast-forward only. A dirty tree, a HEAD ahead of or diverged from the branch, or a tree on any
 * branch is left as found. Returns { moved: sha } | { skipped: reason }.
 */
export function reattachBranch(cwd, sub) {
  const now = headState(cwd);
  if (now.branch) return { skipped: 'on a branch' };
  if (dirtyPaths(cwd).length) return { skipped: 'uncommitted changes' };
  if (git(['merge-base', '--is-ancestor', 'HEAD', sub.main], cwd).code !== 0) return { skipped: `HEAD is not an ancestor of ${sub.main}` };
  if (git(['checkout', '-q', sub.main], cwd).code !== 0) return { skipped: `checkout ${sub.main} failed` };
  return { moved: now.sha };
}

/** End the command trees a dead holder's daemon left running (children.json of its lane): its lock is not free while they live. */
function reapHolderTrees(cfg, holder) {
  const lane = withLane(cfg, holder.lane === 'root' ? null : holder.lane);
  for (const r of reapOrphans(join(brokerPaths(lane).home, 'children.json'))) {
    console.error(`broker: ended ${r.cmd} (pid ${r.pid}), left running in the tree by the ${holder.lane} daemon that died${r.interrupted ? `; its log is kept as ${r.interrupted}` : ''}`);
  }
}

/** Remove a dead holder's lock, ending its command trees and putting a superproject holder's checkout back first. */
export function reclaimStale(cfg, sub) {
  const file = lockPath(cfg, sub);
  const held = read(file);
  if (!held || liveRecord(held)) return held ? { held } : {};
  reapHolderTrees(cfg, held);
  if (held.restore && held.prev) restoreHead(subCwd(cfg, sub), held.prev);
  rmSync(file, { force: true });
  return { reclaimed: held };
}

const otherWant = (cfg, sub, now) => {
  const dir = homeOf(cfg);
  if (!existsSync(dir)) return null;
  const prefix = `${sub.name}.want.`;
  for (const f of readdirSync(dir)) {
    if (!f.startsWith(prefix) || f === `${prefix}${laneName(cfg)}`) continue;
    try { if (now - statSync(join(dir, f)).mtimeMs < WANT_FRESH_MS) return f.slice(prefix.length); } catch { /* gone */ }
  }
  return null;
};

function touchWant(cfg, sub) {
  const file = wantPath(cfg, sub, laneName(cfg));
  try { writeFileSync(file, ''); utimesSync(file, new Date(), new Date()); } catch { /* best effort */ }
}

/** The submodules whose working tree a restore of `journal` writes into. */
export function journalSubtrees(cfg, journal) {
  if (!journal) return [];
  const same = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();
  return cfg.repos.filter((r) => r.submodule && (same(journal.cwd, subCwd(cfg, r)) || (journal.entries || []).some((e) => posix(e.path).startsWith(`${posix(r.path)}/`))));
}

function takeOne(cfg, sub, { id, want, now }) {
  mkdirSync(homeOf(cfg), { recursive: true });
  const file = lockPath(cfg, sub);
  const token = randomBytes(6).toString('hex');
  const restore = cfg.lane !== sub.name;
  for (let attempt = 0; attempt < 3; attempt++) {
    const stale = reclaimStale(cfg, sub);
    if (stale.held) {
      if (want) touchWant(cfg, sub);
      return { ok: false, reason: `${sub.name} tree held by lane ${stale.held.lane} (${stale.held.id}, pid ${stale.held.pid})` };
    }
    const yieldTo = otherWant(cfg, sub, now());
    if (yieldTo) return { ok: false, reason: `${sub.name} tree: yielding to lane ${yieldTo}, which is waiting for it` };
    const record = { lane: laneName(cfg), id, pid: process.pid, host: hostname(), ts: new Date().toISOString(), token, restore, ...(restore ? { prev: headState(subCwd(cfg, sub)) } : {}) };
    try {
      writeFileSync(file, JSON.stringify(record, null, 2), { flag: 'wx' });
      rmSync(wantPath(cfg, sub, laneName(cfg)), { force: true });
      taken += 1;
      return { ok: true, token, record };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  return { ok: false, reason: `${sub.name} tree lock is contended` };
}

function releaseOne(cfg, sub, token) {
  const file = lockPath(cfg, sub);
  const held = read(file);
  if (!held || held.token !== token) return;
  if (held.restore && held.prev) restoreHead(subCwd(cfg, sub), held.prev);
  rmSync(file, { force: true });
}

/**
 * Take the tree of every submodule in `subs` (name order), all or none. `idle: true` claims no
 * priority. `release()` is idempotent and restores a superproject holder's checkout.
 */
export function takeSubtrees(cfg, subs, id, { idle = false, reattach = !idle, now = Date.now } = {}) {
  const taken = [];
  const release = () => { while (taken.length) { const t = taken.pop(); releaseOne(cfg, t.sub, t.token); } };
  for (const sub of [...subs].sort((a, b) => a.name.localeCompare(b.name))) {
    const got = takeOne(cfg, sub, { id, want: !idle, now });
    if (!got.ok) { release(); return { ok: false, reason: got.reason }; }
    taken.push({ sub, token: got.token });
    if (reattach && cfg.lane === sub.name) {
      const back = reattachBranch(subCwd(cfg, sub), sub);
      if (back.moved) console.error(`broker: ${sub.name} was detached at ${back.moved.slice(0, 10)}; back on ${sub.main} before ${id}`);
    }
  }
  return { ok: true, release };
}

/** Daemon start: a lock a dead daemon left behind is removed and its checkout put back. */
export function reconcileSubtrees(cfg) {
  return cfg.repos.filter((r) => r.submodule).map((sub) => reclaimStale(cfg, sub)).filter((r) => r.reclaimed).map((r) => r.reclaimed);
}
