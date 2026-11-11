// live-claims.mjs — the claims of other live sessions that still stand (KIT-D155). session-overlap.mjs names every file
// a live session's write ledger claims and the tree still holds dirty; two kinds of claim there are void and released here:
//
//   - a claim whose dirty content another session's Edit or Write produced from clean text (the committed text, or that
//     session's own earlier clean-based write): the holder's own uncommitted work is not in it, so it cannot be the
//     holder's. Proof is the content hash, never a clock, and never a file that began dirty (KIT-T948).
//   - a claim recorded without a write HEAD: no commit can release it, so it holds for one holder window from the first
//     time it is judged, then lapses. A claim with a recorded HEAD never lapses by time.
//
//   overlappingHolders({ tree, session, paths, now }) -> [{ holder, files }], as session-overlap.mjs, minus the void claims

import { overlappingHolders as heldClaims } from './session-overlap.mjs';
import { sessionWriteHeads } from '../turn-writes.mjs';
import { HOLDER_WINDOW_MS, noteLegacyClaims } from './checkout-holder.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { cleanWriters, writerSession } from './tool-writes.mjs';

const producedByAnother = (tree, file, holderSession) => {
  const hash = contentHashOf(tree, file);
  return Boolean(hash) && cleanWriters(tree, file, hash).some((w) => writerSession(w) !== holderSession);
};

export function overlappingHolders(args) {
  const { tree, now = Date.now() } = args;
  return heldClaims(args).flatMap(({ holder, files }) => {
    const heads = sessionWriteHeads(tree, holder.session);
    const seen = noteLegacyClaims({ tree, session: holder.session, files: files.filter((f) => !heads[f]), now });
    const standing = files.filter((f) => !producedByAnother(tree, f, holder.session)
      && !(seen[f] !== undefined && now - seen[f] >= HOLDER_WINDOW_MS));
    return standing.length ? [{ holder, files: standing }] : [];
  });
}
