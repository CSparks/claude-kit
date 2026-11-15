// The source files a shell delete takes along when its operand is a directory (`rm -rf crates/x`, `Remove-Item -Recurse x`),
// as delete hits for source-shell-gate to judge like `rm <file>` (KIT-T1246): without them a directory operand, which has
// no source extension, removed any writer's files unjudged.
//
//   directoryDeleteHits(command, cwd, root) -> [{ path, deletes: true, from }] one per hand-authored source file, tracked or
//     untracked and not ignored, beneath an existing directory the command deletes; `path` is absolute, `from` the directory
//     it resolves from. A directory whose files git cannot list yields one `<dir>/*` glob hit, which the gate refuses.
//     Operands that expand ($VAR, `...`), build output and `.git` are not resolved here (tree-delete.mjs).

import { lstatSync, realpathSync } from 'node:fs';
import { parse, relative } from 'node:path';
import { gitTry } from './exec.mjs';
import { gitRoot } from './paths.mjs';
import { slashed, isSourcePath } from './source-path.mjs';
import { treeDeleteTargets } from './tree-delete.mjs';

const isDirectory = (path) => {
  try { return lstatSync(path).isDirectory(); } catch { return false; }
};

// A directory path as git spells it: a Windows 8.3 short name resolves to the long form git reports for the work tree.
const realPath = (path) => {
  try { return realpathSync.native(path); } catch { return path; }
};

function sourceFilesBeneath(dirPath) {
  const dir = realPath(dirPath);
  const top = gitRoot(dir);
  if (!top) return [];
  const listing = gitTry(['-c', 'core.quotepath=off', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', slashed(relative(top, dir)) || '.'], top);
  if (!listing.ok) return [{ path: `${slashed(dir)}/*`, deletes: true, from: dir }];
  return listing.out.split('\0').filter((rel) => rel && isSourcePath(rel)).map((rel) => ({ path: `${slashed(top)}/${rel}`, deletes: true, from: dir }));
}

export function directoryDeleteHits(command, cwd) {
  const anyRoot = parse(cwd).root;
  return [...new Set(treeDeleteTargets(command, anyRoot, cwd))].filter(isDirectory).flatMap(sourceFilesBeneath);
}
