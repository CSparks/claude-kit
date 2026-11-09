// holds.mjs — build dirs the sweep must not touch until the maintainer decides (KIT-T911).
//
//   holdsPath()          -> <sweepHome>/build-sweep-holds.txt (CLAUDE_KIT_SWEEP_HOME overrides the home)
//   readHolds(file?)     -> [{ dir, reason, date }] from the file: one `path | reason | date` per line, `#` comments
//   heldBy(dir, holds)   -> the hold that covers `dir` (the held path itself or anything under it), or null

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { sweepHome } from './receipt.mjs';

const FILE = 'build-sweep-holds.txt';
const FIELD_SEPARATOR = '|';

export const holdsPath = () => join(sweepHome(), FILE);

const keyOf = (p) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));

export function readHolds(file = holdsPath()) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [dir, reason = '', date = ''] = l.split(FIELD_SEPARATOR).map((f) => f.trim());
      return { dir, reason, date };
    })
    .filter((h) => h.dir);
}

export function heldBy(dir, holds) {
  const key = keyOf(dir);
  return holds.find((h) => {
    const held = keyOf(h.dir);
    return key === held || key.startsWith(held + sep);
  }) || null;
}
