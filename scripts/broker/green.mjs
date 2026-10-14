// green.mjs — the green cache (KIT-T472). A check-only job that passes records its commands
// under a key of everything that decides the outcome: the repo, the pre-patch tree state
// (cache.mjs treeState), the patch's files, its pins and its commands. A later `--land` job with
// the same key lands on that evidence instead of building and testing the same tree again.
//
// `greenKey({ repo, pre, files, commands, pins })` → hex key.
// `recordGreen(cfg, key, entry)` stores { job, commands, foreign }; `findGreen(cfg, key)` reads it or null.

import { cacheGet, cachePut, hashKey } from './cache.mjs';

const NAME = 'green';
const DELETED = '\u0001deleted';

export function greenKey({ repo, pre, files, commands, pins = [] }) {
  const sorted = [...files].sort(([a], [b]) => (a < b ? -1 : 1));
  return hashKey([
    `repo ${repo}`, pre,
    ...sorted.map(([path, f]) => `file ${path}\0${f.text === null ? DELETED : f.text}`),
    `pins ${JSON.stringify(pins.map((p) => [p.path, p.sha]))}`,
    ...commands.map((c) => `cmd ${String(c).trim()}`),
  ]);
}

export const recordGreen = (cfg, key, entry) => cachePut(cfg, NAME, key, entry);
export const findGreen = (cfg, key) => cacheGet(cfg, NAME, key);
