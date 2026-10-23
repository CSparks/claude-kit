// prune.mjs — plan and apply the removal of dead cargo generations (KIT-T636).
//
//   planProfile(profileDir) -> [{ path, bytes }]  older generations in deps/, .fingerprint/, build/, incremental/
//   newestMtime(buildDir)   -> ms of the newest file the build dir (and its lanes) holds
//   removeAll(items, dryRun) -> { count, bytes, failed }   fs.rm recursive; a locked path is counted, not fatal

import { lstatSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { allProfiles } from './discover.mjs';
import { ARTIFACT_HASH, INCREMENTAL_HASH, parseName, staleItems } from './generations.mjs';

const SHALLOW_NEWEST_DEPTH = 3;
const RM_RETRIES = 2;
const SUBDIRS = [
  { name: 'deps', hash: ARTIFACT_HASH },
  { name: '.fingerprint', hash: ARTIFACT_HASH },
  { name: 'build', hash: ARTIFACT_HASH },
  { name: 'incremental', hash: INCREMENTAL_HASH },
];

const stat = (path) => {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
};
const entryNames = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

/** Newest mtime of `path` and what lies `depth` levels below it. */
function newestWithin(path, depth) {
  const st = stat(path);
  if (!st) return 0;
  let newest = st.mtimeMs;
  if (depth > 0 && st.isDirectory()) {
    for (const name of entryNames(path)) newest = Math.max(newest, newestWithin(join(path, name), depth - 1));
  }
  return newest;
}

export function newestMtime(build) {
  const own = [build.dir, ...allProfiles(build)].map((p) => newestWithin(p, p === build.dir ? 0 : SHALLOW_NEWEST_DEPTH));
  return Math.max(...own);
}

export function treeSize(path) {
  const st = stat(path);
  if (!st) return 0;
  if (!st.isDirectory()) return st.size;
  return entryNames(path).reduce((sum, name) => sum + treeSize(join(path, name)), 0);
}

function listGenerations(dir, hashPattern) {
  const items = [];
  for (const name of entryNames(dir)) {
    const parsed = parseName(name, hashPattern);
    if (!parsed) continue;
    const path = join(dir, name);
    const st = stat(path);
    if (!st) continue;
    const mtimeMs = st.isDirectory() ? newestWithin(path, 1) : st.mtimeMs;
    items.push({ ...parsed, path, mtimeMs, size: st.isDirectory() ? null : st.size });
  }
  return items;
}

export function planProfile(profile) {
  const plan = [];
  for (const { name, hash } of SUBDIRS) {
    for (const it of staleItems(listGenerations(join(profile, name), hash))) {
      plan.push({ path: it.path, bytes: it.size ?? treeSize(it.path) });
    }
  }
  return plan;
}

export function removeAll(items, dryRun) {
  const result = { count: 0, bytes: 0, failed: 0 };
  for (const { path, bytes } of items) {
    if (!dryRun) {
      try {
        rmSync(path, { recursive: true, force: true, maxRetries: RM_RETRIES });
      } catch {
        result.failed += 1;
        continue;
      }
    }
    result.count += 1;
    result.bytes += bytes;
  }
  return result;
}
