// write-plan.mjs — put a planned patch's files on disk (`plan.files`: Map path → { text },
// text null = deleted). A deleted file's directories are pruned up to the first non-empty parent.
// `filesOf(member)` → the paths an admitted job's plan writes or deletes.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pruneEmptyDirs } from './preimage.mjs';

export const filesOf = (m) => [...m.plan.files.keys()];

export function writePlan(cwd, files) {
  for (const [path, f] of files) {
    const abs = join(cwd, path);
    if (f.text === null) { rmSync(abs, { force: true }); pruneEmptyDirs(dirname(abs), cwd); }
    else { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, f.text); }
  }
}
