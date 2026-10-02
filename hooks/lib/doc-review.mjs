// Weekly documentation + structure review cadence (KIT-T281). The same mechanism as the
// weekly memory review: a stamp file whose mtime is the last review, machine-local under
// ~/.claude/.doc-review/, one per project root. Due when missing or at least a week old.
//
//   docReviewAge(root, home?)     -> whole days since the last review (Infinity when never)
//   touchDocReview(root, home?)   -> records a review now
//   repoHasSource(root)           -> true when there is source worth reviewing (checked only when due)

import { statSync, mkdirSync, writeFileSync, utimesSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { walkTree, isSource } from '../../scripts/tree-walk.mjs';

const MS_PER_DAY = 86400000;

// One key per physical root: git, cwd and a script argument spell the same repo differently
// (slashes, drive-letter case, 8.3 names).
function rootKey(root) {
  let r = String(root);
  try { r = realpathSync.native(r); } catch { /* absent — the given spelling is the best we have */ }
  if (process.platform === 'win32') r = r.toLowerCase();
  return r.replace(/[:\/ ]/g, '-').replace(/^-+/, '') || 'root';
}

export const docReviewStamp = (root, home = homedir()) => join(home, '.claude', '.doc-review', rootKey(root));

export function docReviewAge(root, home) {
  try {
    return Math.floor((Date.now() - statSync(docReviewStamp(root, home)).mtimeMs) / MS_PER_DAY);
  } catch {
    return Infinity;
  }
}

export function touchDocReview(root, home) {
  const stamp = docReviewStamp(root, home);
  mkdirSync(dirname(stamp), { recursive: true });
  writeFileSync(stamp, '');
  const now = new Date();
  utimesSync(stamp, now, now);
}

export function repoHasSource(root) {
  for (const entry of walkTree(root).values()) if (entry.files.some(isSource)) return true;
  return false;
}
