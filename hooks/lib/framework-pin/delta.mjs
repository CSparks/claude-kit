// framework-pin/delta.mjs — what a pin move to origin/main would bring in (KIT-D141): the commit subjects, the
// crates the commits change, and the consumer's own crates that depend on them in its Cargo.lock. A "may break"
// crate is a candidate only: a real break is known after a build.
//
//   pinDelta(root, subPath, gitlink, origin) -> { subjects[], more, files[], crates[], mayBreak[], wide }
//     more   subjects past MAX_SUBJECTS; wide  a changed file no crate owns outside docs (a workspace-level change)

import { join } from 'node:path';
import { git } from '../exec.mjs';

export const MAX_SUBJECTS = 8;
const NUL = String.fromCharCode(0);

export async function pinDelta(root, subPath, gitlink, origin) {
  const sub = join(root, subPath);
  const g = (...args) => git(['--no-optional-locks', '-C', sub, ...args]);
  const all = g('log', '--oneline', `${gitlink}..${origin}`).split('\n').filter(Boolean);
  const files = g('diff', '--name-only', '-z', gitlink, origin).split(NUL).filter(Boolean);
  const out = { subjects: all.slice(0, MAX_SUBJECTS), more: Math.max(0, all.length - MAX_SUBJECTS), files, crates: [], mayBreak: [], wide: false };
  if (!files.length) return out;
  try {
    const { changedCrates, submoduleCrates } = await import('../../../scripts/broker/pin-scope.mjs');
    const { dependentsOf, readLock } = await import('../../../scripts/broker/cargo-lock.mjs');
    const { crates, unmapped } = changedCrates(sub, [origin, gitlink], files);
    const lock = readLock(join(root, 'Cargo.lock'));
    const framework = submoduleCrates(sub, origin);
    const inLock = lock ? [...crates].filter((c) => lock.has(c)) : [];
    out.crates = [...crates].sort();
    out.wide = unmapped.length > 0;
    out.mayBreak = lock ? [...dependentsOf(lock, inLock)].filter((n) => lock.get(n)?.local && !framework.has(n)).sort() : [];
  } catch {
    /* a missing broker helper costs the crate lines, never the report */
  }
  return out;
}
