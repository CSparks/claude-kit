// session-overlap.mjs — the per-file test of two sessions writing one checkout (KIT-D155). A live session is read from
// the machine-wide holder registry (lib/checkout-holder.mjs); the files it has changed and not yet committed are its
// write ledger (turn-writes.mjs), minus the edits that were refused it, narrowed to what is still dirty in the tree.
// A second session is a flag only when the incoming writer's paths touch one of those files. A dirty tree and a
// holder's last-write time are never a flag.
//
//   overlappingHolders({ tree, session, paths, now }) -> [{ holder, files }] for every OTHER live session whose uncommitted
//                                                        files touch `paths` (repo-relative, POSIX; '*' and .ai/ never count)
//   overlapLines(overlaps, now)                       -> the lines a block message prints for those sessions

import { git } from './exec.mjs';
import { liveHolders } from './checkout-holder.mjs';
import { overlaps } from './path-overlap.mjs';
import { sessionWrites } from '../turn-writes.mjs';

const STORE_DIR = '.ai/';
const MS_PER_MIN = 60 * 1000;
const lines = (out) => String(out).split('\n').map((l) => l.trim()).filter(Boolean);

// Of `files`, those with changes against HEAD or not tracked: git is asked about only these, never the whole tree.
function stillDirty(tree, files) {
  if (!files.length) return new Set();
  const changed = lines(git(['-c', 'core.quotepath=off', 'diff', '--name-only', 'HEAD', '--', ...files], tree));
  const untracked = lines(git(['-c', 'core.quotepath=off', 'ls-files', '--others', '--exclude-standard', '--', ...files], tree));
  return new Set([...changed, ...untracked]);
}

const named = (paths) => (paths || []).filter((p) => p && p !== '*' && !String(p).startsWith(STORE_DIR));

export function overlappingHolders({ tree, session, paths, now = Date.now() }) {
  const wanted = named(paths);
  if (!wanted.length) return [];
  return liveHolders(tree, now).filter((h) => h.session !== session).flatMap((holder) => {
    const refused = new Set(holder.refused || []);
    const candidates = [...sessionWrites(tree, holder.session)].filter((f) => !refused.has(f) && overlaps(wanted, [f]));
    const dirty = stillDirty(tree, candidates);
    const files = candidates.filter((f) => dirty.has(f));
    return files.length ? [{ holder, files }] : [];
  });
}

export function overlapLines(found, now = Date.now()) {
  return found.flatMap(({ holder, files }) => [
    `  • session ${holder.session}${holder.origin ? ` (from ${holder.origin})` : ''}, last write ${Math.round((now - holder.beatAt) / MS_PER_MIN)} min ago, has uncommitted changes to:`,
    ...files.map((f) => `      ${f}`),
  ]);
}
