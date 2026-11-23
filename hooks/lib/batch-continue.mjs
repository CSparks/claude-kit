// batch-continue.mjs — an edit that continues a batch whose earlier edits already landed passes a build hold (KIT-T1510). A
// writer sends a batch of edits to one crate; another writer's build can start between two of them, and refusing the rest
// leaves the crate half edited (the first edits landed, the one that completes them did not) until that build frees.
// The build began after those edits, so it compiles the half state either way: the remaining edits of the batch go ahead.
//
//   continuesLandedBatch({ tree, absFile, writer, hold, now? }) -> true when `writer` landed an edit in the crate of `absFile`
//     no longer than BATCH_IDLE_S ago, before `hold`'s build started, and that edit is still what its file holds on disk

import { dirname, join, resolve } from 'node:path';
import { BATCH_IDLE_S } from '../../scripts/broker/write-window.mjs';
import { repoRelative } from '../turn-writes.mjs';
import { crateDirOf } from './crate-checks.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { sameWriterId } from './tool-writes.mjs';
import { readTurnRecords } from './turn-state.mjs';

const MS_PER_SECOND = 1000;
const BUILD_START_SLACK_MS = 5000;
const slash = (p) => String(p).replace(/\\/g, '/');

export function continuesLandedBatch({ tree, absFile, writer, hold, now = Date.now() }) {
  try {
    const crate = writer ? crateDirOf(resolve(absFile)) : '';
    const builtAt = Date.parse(hold && hold.ts);
    if (!crate || !Number.isFinite(builtAt)) return false;
    const crateRel = dirname(repoRelative(tree, join(crate, 'Cargo.toml')));
    const prefix = crateRel === '.' ? '' : `${slash(crateRel)}/`;
    return readTurnRecords(tree, 'toolwrites').some((e) => e && e.w && sameWriterId(e.w, writer) && slash(e.p || '').startsWith(prefix)
      && now - (e.ts || 0) <= BATCH_IDLE_S * MS_PER_SECOND && (e.ts || 0) <= builtAt + BUILD_START_SLACK_MS
      && contentHashOf(tree, e.p) === e.h);
  } catch {
    return false;
  }
}
