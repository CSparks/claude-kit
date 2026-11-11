// The effect of one shell call on a repo's working tree (KIT-D117): every dirty path with its mtime and size (and a content hash for source),
// taken before the call and compared after it. Nothing is parsed to find a write, so every sink and path
// form is seen alike.
//   snapshotDirty(root) -> { [relPath]: signature }          capped at ENTRIES_MAX paths
//   headOf(root) -> the commit HEAD names, '' outside a repo
//   changedSince(root, before, headBefore) -> paths the call created, modified, deleted or reverted; a path a
//     HEAD move since headBefore committed (a broker landing) and that is clean now is the landing's, not the call's
//   handWrittenSources(root, before, command, headBefore, { shell }) -> created or changed hand-authored source paths still
//     on disk; a deleted path is no write (nothing is left to re-save), and [] when the command cannot write a source
//     file (inert-command.mjs: generators, build and test runners, kit verbs, readers): a change that landed meanwhile
//     (another agent's edit, a broker landing) is another writer's

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './exec.mjs';
import { isSourcePath } from './shell-source-write.mjs';
import { isInertCommand } from './inert-command.mjs';

const ENTRIES_MAX = 5000;
const MIN_ENTRY_LENGTH = 4;
const GONE = 'gone';

const HASH_MAX_BYTES = 1 << 20;

// Source files carry a content hash beside mtime and size: a same-size rewrite inside one coarse timestamp tick
// leaves the other two unchanged (KIT-T710).
const contentHash = (path, size) => {
  try { return size <= HASH_MAX_BYTES ? createHash('sha1').update(readFileSync(path)).digest('hex') : ''; } catch { return ''; }
};

/** The content hash of `rel` as it sits on disk now, '' when it is missing or too large to hash. */
export const contentHashOf = (root, rel) => {
  try {
    const path = join(root, rel);
    return contentHash(path, statSync(path).size);
  } catch {
    return '';
  }
};

const signature = (root, rel) => {
  try {
    const path = join(root, rel);
    const s = statSync(path);
    return `${s.mtimeMs}:${s.size}${isSourcePath(rel) ? `:${contentHash(path, s.size)}` : ''}`;
  } catch {
    return GONE;
  }
};

export function snapshotDirty(root) {
  const snap = {};
  const parts = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root).split('\0');
  let count = 0;
  for (let i = 0; i < parts.length && count < ENTRIES_MAX; i++) {
    const entry = parts[i];
    if (entry.length < MIN_ENTRY_LENGTH) continue;
    if (/[RC]/.test(entry.slice(0, 2))) i++;
    const rel = entry.slice(3);
    snap[rel] = signature(root, rel);
    count++;
  }
  return snap;
}

export const headOf = (root) => git(['rev-parse', '--verify', '-q', 'HEAD'], root).trim();

const landedSince = (root, headBefore) => {
  const now = headOf(root);
  if (!headBefore || !now || now === headBefore) return new Set();
  return new Set(git(['diff', '--name-only', '-z', headBefore, now], root).split('\0').filter(Boolean));
};

export function changedSince(root, before, headBefore = '') {
  const after = snapshotDirty(root);
  const landed = landedSince(root, headBefore);
  const rels = new Set([...Object.keys(after), ...Object.keys(before)]);
  return [...rels].filter((rel) => !(landed.has(rel) && !(rel in after))
    && (after[rel] ?? signature(root, rel)) !== (before[rel] ?? null));
}

export function handWrittenSources(root, before, command, headBefore = '', { shell = '' } = {}) {
  if (isInertCommand(command, { root, shell })) return [];
  return changedSince(root, before, headBefore).filter((rel) => isSourcePath(rel) && signature(root, rel) !== GONE);
}
