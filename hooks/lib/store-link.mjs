// A directory whose `.ai` is a given store (KIT-T1443). Every `t`, `cap` and `q` verb reaches a store as `<root>/.ai`; a
// central store (`<dataRoot>/projects/<name>`, which IS the .ai dir) has no such root when its registered checkout holds no
// `.ai` link of its own (a framework submodule whose tracked `.ai/decisions/` file keeps a junction out).
//
//   storeRootOf(name, aiDir) -> string   aiDir's parent when it is named `.ai`; else a machine-local directory
//                                        `<registry dir>/claude-kit-store-roots/<name>` holding a `.ai` junction to aiDir,
//                                        created or repointed here; '' when the link cannot be made
//   checkoutOfStoreRoot(root, reg?) -> string  the registered checkout for such a machine-local root (a code search there
//                                        reads the checkout, not the link directory); any other root unchanged

import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readRegistry, registryPath } from './registry.mjs';

export const STORE_ROOTS_DIR = 'claude-kit-store-roots';

const realDir = (path) => {
  try { return realpathSync.native(path).toLowerCase(); } catch { return null; }
};

const isLink = (path) => {
  try { return lstatSync(path).isSymbolicLink(); } catch { return false; }
};

/** The checkout a store root's code lives in: the registered project path for a machine-local store root, else `root`. */
export function checkoutOfStoreRoot(root, registry = readRegistry()) {
  const parent = root ? realDir(dirname(root)) : null;
  if (!parent || parent !== realDir(join(dirname(registryPath()), STORE_ROOTS_DIR))) return root;
  return registry.projects[basename(root)] || root;
}

export function storeRootOf(name, aiDir) {
  if (!aiDir) return '';
  if (basename(aiDir) === '.ai') return dirname(aiDir);
  const root = join(dirname(registryPath()), STORE_ROOTS_DIR, name);
  const link = join(root, '.ai');
  try {
    if (existsSync(link) && realDir(link) === realDir(aiDir)) return root;
    if (isLink(link)) unlinkSync(link);
    mkdirSync(root, { recursive: true });
    symlinkSync(aiDir, link, process.platform === 'win32' ? 'junction' : 'dir');
    return root;
  } catch {
    return '';
  }
}
