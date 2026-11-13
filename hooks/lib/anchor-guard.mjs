// anchor-guard — refuses an automatic write through a link into the resume anchor (KIT-T1150).
// A repo can ship `.ai` or `.ai/SESSION.md` as a symlink, so a write that follows it lands wherever it points.
//
//   assertSafeAnchor(root) -> void; throws when `.ai/SESSION.md` is a link, or `.ai` is a link that does not
//                             lead to a project subtree `projects/<name>` of the shared data repo
//
// The centralized layout (KIT-D008) mounts each project's store from the data repo as a `.ai` link, so that
// one link target is legitimate; every other link is refused.

import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { DATA_PROJECTS_DIR, isDataRepo } from '../data-repo.mjs';

const linkOf = (path) => {
  try { return lstatSync(path).isSymbolicLink(); } catch { return false; }
};

function isCentralMount(link) {
  try {
    const real = realpathSync(link);
    return basename(dirname(real)) === DATA_PROJECTS_DIR && isDataRepo(dirname(dirname(real)));
  } catch {
    return false;
  }
}

export function assertSafeAnchor(root) {
  const store = join(root, '.ai');
  if (linkOf(store) && !isCentralMount(store)) throw new Error(`${store} is a link that does not lead into the shared data repo; the anchor is not written through it`);
  const anchor = join(store, 'SESSION.md');
  if (linkOf(anchor)) throw new Error(`${anchor} is a link; the anchor is not written through it`);
}
