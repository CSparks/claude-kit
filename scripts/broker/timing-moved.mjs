// timing-moved.mjs — what the base moved between two jobs of a lane (KIT-D121). A crate rebuilds when its sources
// changed since the lane's tree was last built, so a landing by another job (or another lane's pin) is a legitimate
// rebuild, not waste. Waste is a crate rebuilt that neither this job's diff nor the base movement reaches.
//
//   movedPaths(repoDir, fromSha, toSha) -> paths changed between the two commits, a moved submodule pin expanded to the
//                                          paths changed inside it (prefixed with the submodule's path); [] when unknown

import { join } from 'node:path';
import { git } from './git.mjs';

const GITLINK = '160000';
const RAW = /^:(\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) \S+\t(.+)$/;

export function movedPaths(repoDir, fromSha, toSha) {
  if (!fromSha || !toSha || fromSha === toSha) return [];
  const diff = git(['diff', '--raw', '--no-abbrev', '--no-renames', fromSha, toSha], repoDir);
  if (diff.code !== 0) return [];
  const paths = [];
  for (const line of diff.out.split('\n')) {
    const m = RAW.exec(line);
    if (!m) continue;
    const [, oldMode, newMode, oldSha, newSha, path] = m;
    if (oldMode === GITLINK && newMode === GITLINK) paths.push(...movedPaths(join(repoDir, path), oldSha, newSha).map((p) => `${path}/${p}`));
    else paths.push(path);
  }
  return paths;
}
