// locks.mjs — every Cargo.lock a build can rewrite under a checkout, submodules included (KIT-T519).
// `git ls-files` of a superproject stops at a gitlink, so the broker's restore journal never saw
// `rapid-game/rust/Cargo.lock`; a superproject job's cargo run rewrote it and nothing put it back.
//
//   lockFilesDeep(cwd) -> [path relative to cwd]  the checkout's own locks plus those of every
//   checked-out submodule, recursively, as `<submodule path>/<lock path>`.
//   resolveLocks(cwd, paths) brings the checkout's own locks in line with the manifests a landing
//   changes, so the commit carries a lock no later cargo run needs to rewrite.
//   holdLocks(cwd, fn) runs fn and leaves every lock byte-identical to how it was found.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { git, lockFiles } from './git.mjs';

const RESOLVE_TIMEOUT_MS = 300_000;

const GITLINK = '160000';

function submodulePaths(cwd) {
  const r = git(['ls-files', '--stage', '-z'], cwd);
  if (r.code !== 0) return [];
  return r.out.split(String.fromCharCode(0)).filter(Boolean)
    .map((rec) => /^(\d+) \w+ \d\t(.+)$/.exec(rec))
    .filter((m) => m && m[1] === GITLINK && existsSync(join(cwd, m[2], '.git')))
    .map((m) => m[2]);
}

export function lockFilesDeep(cwd) {
  const own = lockFiles(cwd);
  const nested = submodulePaths(cwd).flatMap((sub) => lockFilesDeep(join(cwd, sub)).map((p) => `${sub}/${p}`));
  return [...own, ...nested];
}

/** Resolve each of `cwd`'s own locks whose workspace a changed manifest belongs to; cargo failures are left to the job's own commands. */
export function resolveLocks(cwd, paths) {
  if (!paths.some((p) => /(^|\/)Cargo\.toml$/.test(String(p).split('\\').join('/')))) return;
  for (const lock of lockFiles(cwd)) {
    const dir = join(cwd, dirname(lock));
    if (!existsSync(join(dir, 'Cargo.toml'))) continue;
    spawnSync('cargo', ['metadata', '--format-version', '1', '--quiet'], { cwd: dir, stdio: 'ignore', windowsHide: true, timeout: RESOLVE_TIMEOUT_MS });
  }
}

export function holdLocks(cwd, fn) {
  const found = new Map(lockFilesDeep(cwd).map((p) => [p, readFileSync(join(cwd, p))]));
  try {
    return fn();
  } finally {
    for (const [p, bytes] of found) if (!existsSync(join(cwd, p)) || !readFileSync(join(cwd, p)).equals(bytes)) writeFileSync(join(cwd, p), bytes);
    for (const p of lockFilesDeep(cwd)) if (!found.has(p)) rmSync(join(cwd, p), { force: true });
  }
}
