// cache.mjs — the broker's content-keyed result caches (KIT-T472): one JSON file per key under
// `<broker home>/<name>/`, pruned after a week. A key hashes everything that decides an outcome,
// so a hit is a run of the same commands on the same bytes.
//
// `treeState(cfg, cwd)` → the checkout's state as text: both HEADs and the tracked edits in the tree.
// `hashKey(parts)` → hex key over a list of strings.
// `cacheGet(cfg, name, key)` → the stored entry or null; `cachePut(cfg, name, key, entry)`.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { git, revParse } from './git.mjs';

const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const dirOf = (cfg, name) => join(brokerPaths(cfg).home, name);
const oneTree = (cwd) => `${revParse(cwd, 'HEAD')}\n${git(['diff', 'HEAD', '--binary'], cwd).out}`;

export function treeState(cfg, cwd) {
  return cwd === cfg.root ? `root ${oneTree(cfg.root)}` : `root ${oneTree(cfg.root)}\0cwd ${oneTree(cwd)}`;
}

export function hashKey(parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(`${p}\0`);
  return h.digest('hex');
}

export function cacheGet(cfg, name, key) {
  const f = join(dirOf(cfg, name), `${key}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
}

export function cachePut(cfg, name, key, entry) {
  const dir = dirOf(cfg, name);
  mkdirSync(dir, { recursive: true });
  prune(dir);
  writeFileSync(join(dir, `${key}.json`), JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2));
}

function prune(dir) {
  const now = Date.now();
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    try { if (now - statSync(f).mtimeMs > KEEP_MS) rmSync(f, { force: true }); } catch { /* raced with another prune */ }
  }
}
