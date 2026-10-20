// `broker.mjs clean <path...> | --pycache`: clear untracked leftovers (a `__pycache__` a script wrote
// into the tree) so a stray build product never needs a hand `rm`. Tracked files are never touched;
// paths outside the checkout, `.git` and the broker's own home are refused.
//
//   cleanUntracked(cfg, paths) -> { removed: string[], refused: [{ path, reason }] }
//   pycacheDirs(root)          -> every `__pycache__` directory under root

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { git } from './git.mjs';
import { brokerPaths } from './config.mjs';

const SKIP_WALK = new Set(['.git', 'node_modules', 'target']);
const PYCACHE = '__pycache__';

const inside = (root, abs) => {
  const rel = relative(root, abs);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

const trackedUnder = (root, rel) => git(['ls-files', '--', rel], root).out !== '';

export function pycacheDirs(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink() || SKIP_WALK.has(e.name)) continue;
      if (e.name === PYCACHE) found.push(join(dir, e.name));
      else walk(join(dir, e.name));
    }
  };
  walk(root);
  return found;
}

export function cleanUntracked(cfg, paths) {
  const root = resolve(cfg.root);
  const home = resolve(brokerPaths(cfg).home);
  const removed = [];
  const refused = [];
  for (const p of paths) {
    const abs = resolve(root, p);
    const rel = relative(root, abs).split(sep).join('/');
    if (!inside(root, abs)) refused.push({ path: p, reason: 'outside the checkout' });
    else if (rel === '.git' || rel.startsWith('.git/')) refused.push({ path: p, reason: 'inside .git' });
    else if (abs === home || abs.startsWith(home + sep)) refused.push({ path: p, reason: "the broker's own home" });
    else if (trackedUnder(root, rel)) refused.push({ path: p, reason: 'tracked files live there; delete them with a patch' });
    else if (!existsSync(abs)) refused.push({ path: p, reason: 'does not exist' });
    else {
      rmSync(abs, { recursive: true, force: true });
      removed.push(rel);
    }
  }
  return { removed, refused };
}
