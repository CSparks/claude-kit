// A session inside a framework's submodule checkout writes to the framework's store (KIT-T738).
//
// A game checks the framework out as a git submodule (marblequest/rapid-game). That checkout has no
// `.ai/config.yml` of its own, so the nearest store above it is the GAME's, and a decision filed there
// takes the game's key. When the submodule is named like a registered project (registry `projects`),
// the project's store owns the work instead.
//
//   frameworkStoreRoot(start, nearest, registry?) -> the owning store root, or null to keep `nearest`
//     start:   the directory the command acts in; nearest: storeRoot(start) (null when none)

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { readRegistry } from './registry.mjs';
import { storeRoot } from './paths.mjs';

const SUBMODULE_GITDIR = /^gitdir:\s*.*[\\/]modules[\\/]/m;

const within = (dir, parent) => resolve(dir) === resolve(parent) || resolve(dir).startsWith(resolve(parent) + sep);

// The nearest directory from `start` up to (excluding) `limit` whose `.git` is a submodule's gitdir file.
function submoduleRoot(start, limit) {
  for (let dir = resolve(start); !limit || (resolve(dir) !== resolve(limit) && within(dir, limit)); dir = dirname(dir)) {
    const marker = join(dir, '.git');
    if (existsSync(marker)) {
      if (!statSync(marker).isFile()) return null;
      try { return SUBMODULE_GITDIR.test(readFileSync(marker, 'utf8')) ? dir : null; } catch { return null; }
    }
    if (dirname(dir) === dir) return null;
  }
  return null;
}

export function frameworkStoreRoot(start, nearest, registry = readRegistry()) {
  const top = submoduleRoot(start, nearest);
  if (!top) return null;
  const path = registry.projects[basename(top)];
  const owner = path ? storeRoot(resolve(path)) : null;
  return owner && (!nearest || resolve(owner) !== resolve(nearest)) ? owner : null;
}
