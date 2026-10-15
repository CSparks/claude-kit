// locks.mjs — every Cargo.lock a build can rewrite under a checkout, submodules included (KIT-T519).
// `git ls-files` of a superproject stops at a gitlink, so the broker's restore journal never saw
// `rapid-game/rust/Cargo.lock`; a superproject job's cargo run rewrote it and nothing put it back.
//
//   lockFilesDeep(cwd) -> [path relative to cwd]  the checkout's own locks plus those of every
//   checked-out submodule, recursively, as `<submodule path>/<lock path>`.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { git, lockFiles } from './git.mjs';

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
