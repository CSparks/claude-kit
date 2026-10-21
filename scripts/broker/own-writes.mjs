// own-writes.mjs — put back the tracked files a job's own commands rewrote (KIT-T616). The journal
// holds only the paths a patch touches and the lock files, so a test that writes a tracked file (a
// bless test rewriting a golden) leaves dirt the broker did not journal and the queue pauses on it.
//
//   sweepOwnWrites(cfg, { id, cwd, before }) -> [{ path, backup }] restored from HEAD
//
// `before` is the tracked-dirty paths (git.mjs dirtyPaths) taken before the job wrote anything; only an
// unstaged change to a file outside it is the job's. Hand work is never touched: a path dirty before,
// a staged change and a submodule pointer all stay. `backup` is the blob holding the discarded bytes.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { git, hashObject, trackedModifications } from './git.mjs';
import { recordWritten } from './written.mjs';

const GITLINK_MODE = '160000';
const posix = (p) => String(p).split(String.fromCharCode(92)).join('/');
const isGitlink = (cwd, path) => git(['ls-files', '-s', '--', path], cwd).out.startsWith(GITLINK_MODE);

export function sweepOwnWrites(cfg, { id, cwd, before }) {
  const skip = new Set(before.map(posix));
  const swept = [];
  for (const { xy, path } of trackedModifications(cwd).records) {
    if (xy[0] !== ' ' || skip.has(posix(path)) || isGitlink(cwd, path)) continue;
    const backup = existsSync(join(cwd, path)) ? hashObject(cwd, path) : null;
    if (git(['checkout', '-q', 'HEAD', '--', path], cwd).code !== 0) continue;
    console.error(`broker: put ${path} back from HEAD: job ${id} rewrote it outside its journal${backup ? ` (discarded bytes kept as blob ${backup})` : ''}`);
    swept.push({ path, backup });
  }
  if (swept.length) recordWritten(cfg, cwd, swept.map((s) => s.path), id);
  return swept;
}
