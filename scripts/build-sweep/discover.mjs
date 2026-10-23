// discover.mjs — find cargo build dirs at ANY depth under a root (KIT-T636).
//
//   findBuildDirs(root) -> [BuildDir]
//   BuildDir = { dir, primary, cargo, profiles: [profileDir], lanes: [BuildDir] }
//
// The walk is unbounded: it prunes node_modules/.git/.venv and never descends into a build dir it
// found. A dir is a build dir when it carries cargo's CACHEDIR.TAG or a profile dir (debug,
// release, <triple>/<profile>); a child of a build dir that is itself a build dir is a broker
// lane. A profile dir holds .fingerprint, deps or incremental. `cargo` is true only on hard
// cargo evidence (the tag, .rustc_info.json or a .fingerprint) — the bar for whole-dir deletion.
// `primary` is <crate-root>/target outside a worktree: pruned, never deleted whole.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, sep } from 'node:path';

const PRUNED = new Set(['node_modules', '.git', '.venv']);
const PROFILE_NAMES = new Set(['debug', 'release']);
const PROFILE_MARKERS = ['.fingerprint', 'deps', 'incremental'];
const CACHE_TAG = 'CACHEDIR.TAG';
const RUSTC_INFO = '.rustc_info.json';
const TRIPLE_ARCH = /^(x86_64|aarch64|i[3-6]86|arm\w*|thumb\w+|wasm(32|64)|riscv\w+|powerpc\w*|s390x|mips\w*|loongarch\w+)-/;
const MAX_LANE_DEPTH = 3;

const readEntries = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};
const subdirs = (dir) => readEntries(dir).filter((e) => e.isDirectory() && !e.isSymbolicLink());

export const isProfileDir = (dir) => PROFILE_MARKERS.some((m) => existsSync(join(dir, m)));
const isTriple = (name) => TRIPLE_ARCH.test(name);

function hasCacheTag(dir) {
  try {
    return readFileSync(join(dir, CACHE_TAG), 'utf8').toLowerCase().includes('cargo');
  } catch {
    return false;
  }
}

/** Profile dirs directly under a build dir: debug/release and <triple>/<profile>. */
export function profileDirsOf(buildDir) {
  const found = [];
  for (const e of subdirs(buildDir)) {
    const path = join(buildDir, e.name);
    if (PROFILE_NAMES.has(e.name) && isProfileDir(path)) found.push(path);
    else if (isTriple(e.name)) {
      for (const p of subdirs(path)) if (isProfileDir(join(path, p.name))) found.push(join(path, p.name));
    }
  }
  return found;
}

const isPrimary = (dir) =>
  basename(dir) === 'target' && existsSync(join(dirname(dir), 'Cargo.toml')) && !dir.split(sep).includes('worktrees');

function describe(dir, primary, depth) {
  const profiles = profileDirsOf(dir);
  const tagged = hasCacheTag(dir);
  if (!tagged && !profiles.length) return null;
  const lanes = [];
  if (depth < MAX_LANE_DEPTH) {
    for (const e of subdirs(dir)) {
      if (PROFILE_NAMES.has(e.name) || isTriple(e.name)) continue;
      const lane = describe(join(dir, e.name), false, depth + 1);
      if (lane) lanes.push(lane);
    }
  }
  const cargo = tagged || existsSync(join(dir, RUSTC_INFO)) || profiles.some((p) => existsSync(join(p, '.fingerprint')));
  return { dir, primary, cargo, profiles, lanes };
}

export function findBuildDirs(root) {
  const found = [];
  const walk = (dir) => {
    const here = describe(dir, isPrimary(dir), 0);
    if (here) {
      found.push(here);
      return;
    }
    for (const e of subdirs(dir)) if (!PRUNED.has(e.name)) walk(join(dir, e.name));
  };
  walk(root);
  return found;
}

/** Every profile dir of a build dir and its lanes. */
export const allProfiles = (b) => [...b.profiles, ...b.lanes.flatMap(allProfiles)];

/** The BuildDir rooted at `dir`, or null when it is not one. */
export const buildDirAt = (dir) => describe(dir, isPrimary(dir), 0);
