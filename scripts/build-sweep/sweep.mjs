// sweep.mjs — one pass over every cargo build dir under a root (KIT-T636).
//
//   sweep(root, { dryRun, now, snapshot }) -> receipt
//
// Per profile dir: drop the older generations in deps/, .fingerprint/, build/, incremental/
// (the newest generation of each crate always survives). A build dir that is not its repo's
// primary target and has been idle IDLE_DAYS goes whole. A repo with cargo running against it
// or a live broker lock is skipped.

import { relative, sep, join } from 'node:path';
import { existsSync } from 'node:fs';
import { allProfiles, findBuildDirs } from './discover.mjs';
import { skipReason, processSnapshot } from './guard.mjs';
import { newestMtime, planProfile, removeAll, treeSize } from './prune.mjs';

export const IDLE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function repoOf(dir, root) {
  const segments = relative(root, dir).split(sep);
  return segments.length > 1 && !existsSync(join(root, '.git')) ? join(root, segments[0]) : root;
}

const flatten = (b) => [b, ...b.lanes.flatMap(flatten)];

function sweepBuild(b, ctx, tally) {
  for (const lane of b.lanes) sweepBuild(lane, ctx, tally);
  const idle = ctx.now - newestMtime(b) >= IDLE_DAYS * MS_PER_DAY;
  if (!b.primary && b.cargo && idle) {
    tally(removeAll([{ path: b.dir, bytes: treeSize(b.dir) }], ctx.dryRun), true);
    return;
  }
  for (const profile of b.profiles) tally(removeAll(planProfile(profile), ctx.dryRun), false);
}

export function sweep(root, { dryRun = false, now = Date.now(), snapshot = processSnapshot() } = {}) {
  const builds = findBuildDirs(root);
  const byRepo = new Map();
  for (const b of builds) {
    const repo = repoOf(b.dir, root);
    byRepo.set(repo, [...(byRepo.get(repo) || []), b]);
  }
  const receipt = {
    at: new Date(now).toISOString(), root, dryRun, buildDirs: builds.flatMap(flatten).length,
    profiles: builds.reduce((n, b) => n + allProfiles(b).length, 0),
    removed: 0, wholeDirs: 0, bytes: 0, failed: 0, repos: {}, skipped: [],
  };
  for (const [repo, list] of byRepo) {
    const reason = skipReason(repo, list, snapshot, root);
    const name = relative(root, repo) || repo;
    if (reason) {
      receipt.skipped.push({ repo: name, reason });
      continue;
    }
    const stats = (receipt.repos[name] = { removed: 0, bytes: 0 });
    const tally = (r, whole) => {
      for (const t of [receipt, stats]) {
        t.removed += r.count;
        t.bytes += r.bytes;
      }
      receipt.failed += r.failed;
      if (whole) receipt.wholeDirs += r.count;
    };
    for (const b of list) sweepBuild(b, { now, dryRun }, tally);
  }
  return receipt;
}
