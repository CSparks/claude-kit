// green.mjs — the green cache (KIT-T472). A check-only job that passes records its commands
// under a key of everything that decides the outcome: the repo, both HEADs, the tracked edits
// already in the tree, the patch's files, its pins and its commands. A later `--land` job with
// the same key lands on that evidence instead of building and testing the same tree again.
//
// `greenKey(cfg, cwd, { repo, files, commands, pins })` → hex key.
// `recordGreen(cfg, key, entry)` stores { job, commands, foreign }; `findGreen(cfg, key)` reads it or null.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { git, revParse } from './git.mjs';

const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const dirOf = (cfg) => join(brokerPaths(cfg).home, 'green');

const treeState = (cwd) => `${revParse(cwd, 'HEAD')}\n${git(['diff', 'HEAD', '--binary'], cwd).out}`;

export function greenKey(cfg, cwd, { repo, files, commands, pins = [] }) {
  const h = createHash('sha256');
  h.update(`repo ${repo}\0`);
  h.update(`root ${treeState(cfg.root)}\0`);
  if (cwd !== cfg.root) h.update(`cwd ${treeState(cwd)}\0`);
  for (const [path, f] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) h.update(`file ${path}\0${f.text === null ? '\u0001deleted' : f.text}\0`);
  h.update(`pins ${JSON.stringify(pins.map((p) => [p.path, p.sha]))}\0`);
  for (const c of commands) h.update(`cmd ${String(c).trim()}\0`);
  return h.digest('hex');
}

export function recordGreen(cfg, key, entry) {
  const dir = dirOf(cfg);
  mkdirSync(dir, { recursive: true });
  prune(dir);
  writeFileSync(join(dir, `${key}.json`), JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2));
}

export function findGreen(cfg, key) {
  const f = join(dirOf(cfg), `${key}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
}

function prune(dir) {
  const now = Date.now();
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    try { if (now - statSync(f).mtimeMs > KEEP_MS) rmSync(f, { force: true }); } catch { /* raced with another prune */ }
  }
}
