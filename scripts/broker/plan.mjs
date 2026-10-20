// plan.mjs — a job's ops planned against HEAD (KIT-T477): the one entry point submit and the
// daemon share. A `delete` naming a tracked directory becomes a delete of each tracked file under
// it, so the plan, the restore journal and the landing only ever hold file paths.
//
// `expandOps(cwd, ops, ref)` → ops with directory deletes expanded, read at `ref` (default HEAD).
// `planAtHead(cwd, ops, { read, ref })` → { ops, plan } where plan is apply.mjs's dryRun result over `ops`;
//   `read(path)` replaces the reader (linked.mjs reads submodule paths at the recorded commit); `ref` is
//   the commit the lane will run on (lane-ref.mjs), default HEAD.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dryRun } from './apply.mjs';
import { showFile, treeFiles } from './git.mjs';

const posix = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');

export function expandOps(cwd, ops = [], ref = 'HEAD') {
  return ops.flatMap((op) => {
    if (op.kind !== 'delete') return [op];
    const path = posix(op.path);
    const files = treeFiles(cwd, ref, path);
    const isDir = files.length && !(files.length === 1 && files[0] === path);
    return isDir ? files.map((f) => ({ ...op, path: f })) : [op];
  });
}

export function planAtHead(cwd, ops, { ref = 'HEAD', read = (p) => showFile(cwd, ref, p), ownFiles = [] } = {}) {
  const own = new Set(ownFiles);
  const expanded = expandOps(cwd, ops, ref);
  const plan = dryRun(expanded, read, { onDisk: (p) => !own.has(p) && existsSync(join(cwd, p)) });
  return { ops: expanded, plan };
}
