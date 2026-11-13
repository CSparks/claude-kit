// anchor-guard — refuses an automatic write through a link into the resume anchor (KIT-T1150).
// A repo can ship `.ai`, `.ai/SESSION.md` or `.ai/.session-backups` as a symlink, so a write that follows
// it lands wherever it points.
//
//   assertSafeAnchor(root)              -> void; throws when `.ai/SESSION.md` is a link, or `.ai` is a link that does
//                                          not lead to a configured store (below)
//   assertSafeBackupFolder(aiDir, dir)  -> void; throws when the backup folder or its .gitignore is a link, or the
//                                          folder's real path leaves realpath(.ai)
//   lexists(path)                       -> true when anything, a dangling link included, sits at `path`
//
// The only link target allowed for `.ai` is a configured one: realpath(.ai) equals
// realpath(<registry dataRoot>/projects/<name>) for a project the registry maps to this repo root, or the
// configured unbounded store (registry `unbounded`, CLAUDE_KIT_UNBOUNDED_AI). Nothing is inferred from layout.

import { lstatSync, realpathSync } from 'node:fs';
import { join, relative, isAbsolute, sep } from 'node:path';
import { readRegistry } from './registry.mjs';
import { unboundedAiDir } from './unbounded.mjs';

const DATA_PROJECTS_DIR = 'projects';

export function lexists(path) {
  try { lstatSync(path); return true; } catch { return false; }
}

const isLink = (path) => {
  try { return lstatSync(path).isSymbolicLink(); } catch { return false; }
};

const real = (path) => {
  try { return realpathSync.native(path); } catch { return null; }
};

const sameDir = (a, b) => {
  const x = real(a);
  return !!x && x === real(b);
};

function configuredMounts(root) {
  const reg = readRegistry();
  const mounts = [];
  if (reg.dataRoot) {
    for (const [name, repo] of Object.entries(reg.projects)) {
      if (sameDir(repo, root)) mounts.push(join(reg.dataRoot, DATA_PROJECTS_DIR, name));
    }
  }
  const unbounded = unboundedAiDir();
  if (unbounded) mounts.push(unbounded);
  return mounts;
}

export function assertSafeAnchor(root) {
  const store = join(root, '.ai');
  if (isLink(store) && !configuredMounts(root).some((mount) => sameDir(mount, store))) {
    throw new Error(`${store} is a link that does not lead to this project's configured store; the anchor is not written through it`);
  }
  const anchor = join(store, 'SESSION.md');
  if (isLink(anchor)) throw new Error(`${anchor} is a link; the anchor is not written through it`);
}

export function assertSafeBackupFolder(aiDir, folder) {
  if (isLink(folder)) throw new Error(`${folder} is a link; backups are not written through it`);
  if (isLink(join(folder, '.gitignore'))) throw new Error(`${join(folder, '.gitignore')} is a link; backups are not written through it`);
  const inside = real(folder);
  const base = real(aiDir);
  if (!inside || !base) return;
  const rel = relative(base, inside);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`${folder} resolves outside ${aiDir}; backups are not written there`);
}
