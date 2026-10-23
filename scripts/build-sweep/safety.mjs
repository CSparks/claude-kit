// safety.mjs — may a build dir be deleted whole? (KIT-T636)
//
//   wholeDirBlocker(buildDir, root, parent) -> a reason string, or null when deletion is allowed
//
// The sweep runs unattended with recursive rm, and every marker it recognises can be planted in
// source. So a whole-dir delete needs all of: a verified cargo build dir, not the scan root, not a
// primary target, a target-shaped name (or a lane of a target), none of Cargo.toml / .git / src
// inside, and not one path tracked by git. If git cannot answer, the dir is kept.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const TARGET_NAME = /^(target|target-.+|.+-target)$/;
const SOURCE_MARKERS = ['Cargo.toml', '.git', 'src'];

function trackedReason(dir) {
  try {
    const out = execFileSync('git', ['ls-files', '--', '.'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() ? 'git tracks files inside it' : null;
  } catch {
    return 'git could not confirm it is untracked';
  }
}

export function wholeDirBlocker(b, root, parent) {
  if (!b.cargo) return 'not a verified cargo build dir';
  if (resolve(b.dir) === resolve(root)) return 'it is the scan root';
  if (b.primary) return 'it is the primary target';
  const targetShaped = TARGET_NAME.test(basename(b.dir)) || TARGET_NAME.test(basename(dirname(b.dir))) || Boolean(parent?.cargo);
  if (!targetShaped) return 'its name is not a target dir';
  const marker = SOURCE_MARKERS.find((m) => existsSync(join(b.dir, m)));
  if (marker) return `it contains ${marker}`;
  return trackedReason(b.dir);
}
