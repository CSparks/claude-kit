// build-tree.mjs — the SessionStart view of cargo build dirs (KIT-T273, KIT-T635).
//
//   buildTreeLine(root)  -> a one-line runaway warning for any build dir under root, else null
//   sweepStatusLines()   -> the nightly sweep's last receipt, or a warning when it is not scheduled / not firing
//
// Cargo has no garbage collector: every rebuild leaves its predecessor in target/, and rustc prunes an
// incremental session only on a clean finalize. The waste lives at any depth — submodule targets,
// target-* siblings, broker lanes, worktrees — so the check walks the whole repo (findBuildDirs).
// Counting directory ENTRIES is a readdir and stays fast at any size; bytes are summed only once a
// count has tripped, so a healthy tree costs nothing.

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { allProfiles, findBuildDirs } from '../../scripts/build-sweep/discover.mjs';
import { describeReceipt, lastReceipt } from '../../scripts/build-sweep/receipt.mjs';
import { isScheduled } from '../../scripts/build-sweep/schedule.mjs';
import { cacheDir, pathKey } from './stat-cache.mjs';

// Measured on stiletto 2026-09-06: a fresh tree is 1,611 deps entries; the runaway one was 40,811.
export const DEPS_ENTRY_NAG = 8000;
export const INCREMENTAL_DIR_NAG = 500;
const LISTED_DIRS = 3;
const BYTES_CACHE_MS = 24 * 60 * 60 * 1000;
const SWEEP_STALE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GIB = 1024 ** 3;

// Entry count for one directory, or 0 when it does not exist. A build tree churns while this runs.
export function entryCount(dir) {
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

// Bytes of the files directly in `dir` — the artifacts live flat in deps/.
function flatBytes(dir) {
  let total = 0;
  try {
    for (const name of readdirSync(dir)) {
      try {
        const st = statSync(join(dir, name));
        if (st.isFile()) total += st.size;
      } catch {
        /* raced with the compiler — skip */
      }
    }
  } catch {
    /* no such dir */
  }
  return total;
}

// Total size of a deps dir. Statting ~50k artifacts costs ~0.7 s, so the total is cached per
// directory: within BYTES_CACHE_MS the cached bytes-per-entry scales the current entry count.
export function depsBytes(dir, count) {
  const file = join(cacheDir(), `deps-bytes-${pathKey(dir)}.json`);
  try {
    const c = JSON.parse(readFileSync(file, 'utf8'));
    if (c.count > 0 && Date.now() - c.at < BYTES_CACHE_MS) return { bytes: (c.bytes / c.count) * count, approx: true };
  } catch {
    /* no cache yet */
  }
  const bytes = flatBytes(dir);
  try {
    mkdirSync(cacheDir(), { recursive: true });
    writeFileSync(file, JSON.stringify({ count, bytes, at: Date.now() }));
  } catch {
    /* cache is best-effort */
  }
  return { bytes, approx: false };
}

function trippedProfile(root, profile) {
  const deps = entryCount(join(profile, 'deps'));
  const sessions = entryCount(join(profile, 'incremental'));
  if (deps < DEPS_ENTRY_NAG && sessions < INCREMENTAL_DIR_NAG) return null;
  const parts = [];
  if (deps >= DEPS_ENTRY_NAG) {
    const { bytes, approx } = depsBytes(join(profile, 'deps'), deps);
    parts.push(`deps holds ${deps.toLocaleString()} artifacts (${approx ? '~' : ''}${(bytes / GIB).toFixed(1)} GB)`);
  }
  if (sessions >= INCREMENTAL_DIR_NAG) parts.push(`${sessions.toLocaleString()} orphaned incremental sessions`);
  return `${relative(root, profile).split(sep).join('/')}: ${parts.join(', ')}`;
}

export function buildTreeLine(root) {
  const tripped = findBuildDirs(root)
    .flatMap(allProfiles)
    .map((profile) => trippedProfile(root, profile))
    .filter(Boolean);
  if (!tripped.length) return null;
  const more = tripped.length > LISTED_DIRS ? ` (+${tripped.length - LISTED_DIRS} more)` : '';
  return (
    `BUILD TREE RUNAWAY: ${tripped.slice(0, LISTED_DIRS).join('; ')}${more}. Cargo never collects these — every rebuild ` +
    `leaves its predecessor behind. Reclaim now: node <kit>/scripts/build-sweep.mjs ${root} (keeps the newest ` +
    `generation of every crate; add --dry-run to preview). The nightly task does the same.`
  );
}

export function sweepStatusLines() {
  if (!isScheduled()) {
    return ['BUILD SWEEP NOT SCHEDULED: nothing prunes cargo build dirs nightly. Install: node <kit>/scripts/build-sweep.mjs --install'];
  }
  const last = lastReceipt();
  if (!last) return ['Build sweep: scheduled, no run recorded yet.'];
  const age = Math.floor((Date.now() - Date.parse(last.at)) / MS_PER_DAY);
  if (age >= SWEEP_STALE_DAYS) {
    return [`BUILD SWEEP NOT FIRING: last run ${describeReceipt(last)} (${age}d ago). Check the task, or run: node <kit>/scripts/build-sweep.mjs`];
  }
  return [`Build sweep last run ${describeReceipt(last)}.`];
}
