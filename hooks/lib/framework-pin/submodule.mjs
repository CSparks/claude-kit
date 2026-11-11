// framework-pin/submodule.mjs — where a consumer keeps a framework's submodule, and whether a broker owns its tree.
//
//   submodulePath(root, framework)  -> the submodule's repo-relative posix path, or null when `root` carries none as a checkout
//   gitlinkOf(root, path)           -> the sha the superproject's HEAD records for the submodule, or ''
//   brokerHolds(root, name)         -> the live broker lock record on the submodule's tree, or null (default target dir only)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from '../exec.mjs';

const SECTION = /\[submodule\s+"([^"]+)"\]([^[]*)/g;
const GITLINK = /^160000 commit ([0-9a-f]{40})\t/;

function declaredPaths(root, needle) {
  try {
    const text = readFileSync(join(root, '.gitmodules'), 'utf8');
    return [...text.matchAll(SECTION)].flatMap(([, name, body]) => {
      const path = /^\s*path\s*=\s*(.+)$/m.exec(body)?.[1].trim();
      const url = /^\s*url\s*=\s*(.+)$/m.exec(body)?.[1].trim() || '';
      return path && [name, path, url].some((s) => s.includes(needle)) ? [path] : [];
    });
  } catch {
    return [];
  }
}

export function submodulePath(root, framework) {
  if (!framework.submodule) return null;
  const candidates = [...declaredPaths(root, framework.submodule), framework.submodule];
  const found = candidates.find((p) => existsSync(join(root, p, '.git')));
  return found ? found.replace(/\\/g, '/') : null;
}

export function gitlinkOf(root, path) {
  return GITLINK.exec(git(['--no-optional-locks', 'ls-tree', 'HEAD', '--', path], root))?.[1] || '';
}

export async function brokerHolds(root, name) {
  try {
    const { liveTreeHolder } = await import('../../../scripts/broker/subtree.mjs');
    return liveTreeHolder({ targetDir: join(root, 'target') }, { name });
  } catch {
    return null;
  }
}
