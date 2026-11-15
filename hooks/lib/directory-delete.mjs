// The source files a shell delete takes along when its operand is a directory (`rm -rf crates/x`, `Remove-Item -Recurse x`),
// as delete hits for source-shell-gate to judge like `rm <file>` (KIT-T1246): without them a directory operand, which has
// no source extension, removed any writer's files unjudged.
//
//   directoryDeleteHits(command, cwd) -> [{ path, deletes: true, from }] one per hand-authored source file, tracked or
//     untracked and not ignored, beneath a directory the command deletes; `path` is absolute, `from` the directory it
//     resolves from. A symlink or junction to a directory is judged as its target. A directory whose files git cannot
//     list yields one `<dir>/*` glob hit, which the gate refuses ("name each file"); so does a nested repository inside
//     it (a submodule, an untracked clone): git is never run inside one to list it, its files are named one by one.
//     A listing that could not run (git missing, an error) yields a glob hit carrying `incomplete`, the reason, which the gate
//     refuses as a check it could not complete.
//     Operands that expand ($VAR, `...`), build output and `.git` are not resolved here (tree-delete.mjs).

import { lstatSync, realpathSync, statSync } from 'node:fs';
import { parse, relative } from 'node:path';
import { gitTry } from './exec.mjs';
import { gitRootOfFileChecked } from './paths.mjs';
import { slashed, isSourcePath } from './source-path.mjs';
import { treeDeleteTargets } from './tree-delete.mjs';

const isDirectory = (path) => {
  try { return statSync(path).isDirectory(); } catch { return false; }
};

// A directory entry of a listing: a submodule or an untracked nested repository. A link inside a tree is removed, never followed.
const isNestedDirectory = (path) => {
  try { return lstatSync(path).isDirectory(); } catch { return false; }
};

// A directory path as git spells it: a link and a Windows 8.3 short name resolve to the real long form.
const realPath = (path) => {
  try { return realpathSync.native(path); } catch { return path; }
};

// A glob hit the gate refuses. A nested directory is named `<dir>*` so the gate resolves the repository holding the entry,
// never one inside the nested directory.
// `incomplete` marks a hit the gate refuses because the listing could not run (KIT-T1271), apart from one it refuses by rule.
const refused = (dir, glob, incomplete = '') => [{ path: `${slashed(dir)}${glob}`, deletes: true, from: dir, ...(incomplete ? { incomplete } : {}) }];

function sourceFilesBeneath(dirPath) {
  const dir = realPath(dirPath);
  let top;
  try {
    top = gitRootOfFileChecked(`${dir}/.`);
  } catch (e) {
    return refused(dir, '/*', e.message);
  }
  if (!top) return [];
  const listing = gitTry(['-c', 'core.quotepath=off', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', slashed(relative(top, dir)) || '.'], top);
  if (!listing.ok) return refused(dir, '/*', `git ls-files failed in ${top}: ${String(listing.out).trim().slice(0, 200)}`);
  return listing.out.split('\0').filter(Boolean).flatMap((entry) => {
    const rel = entry.replace(/\/$/, '');
    if (isNestedDirectory(`${top}/${rel}`)) return refused(`${top}/${rel}`, '*');
    return isSourcePath(rel) ? [{ path: `${slashed(top)}/${rel}`, deletes: true, from: dir }] : [];
  });
}

export function directoryDeleteHits(command, cwd) {
  const anyRoot = parse(cwd).root;
  return [...new Set(treeDeleteTargets(command, anyRoot, cwd))].filter(isDirectory).flatMap((dir) => sourceFilesBeneath(dir));
}
