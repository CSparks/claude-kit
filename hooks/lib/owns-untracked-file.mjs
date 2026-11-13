// Whether a caller may delete a file by shell: it is untracked and its bytes on disk are exactly what this caller's
// Edit or Write tool left (the accepted-writes ledger, tool-writes.mjs), with no other writer's tool having left them.
// A deletion writes nothing the pre-write checks could judge, so a scratch file the caller authored is its own to remove;
// tracked source, a file another session or agent wrote and a file changed since the tool left it stay with the gate.
//
//   deleteRefusal(root, rel, writer) -> '' when the caller may delete, else why not: one of DELETE_REFUSALS
//   ownsUntrackedFile(root, rel, writer) -> boolean   deleteRefusal(...) === ''; any failure answers false

import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { toolWriteProves } from './tool-writes.mjs';

const ANY_TIME_MS = 0;
const GLOB_CHARS = /[*?[\]]/;

export const DELETE_REFUSALS = Object.freeze({
  noWriter: 'no-writer',
  glob: 'glob',
  missing: 'missing',
  tracked: 'tracked',
  unrecorded: 'unrecorded',
  otherWriter: 'other-writer',
});

const isTracked = (root, rel) => gitTry(['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', rel], root).ok;

export function deleteRefusal(root, rel, writer) {
  try {
    if (!writer) return DELETE_REFUSALS.noWriter;
    if (!root || !rel) return DELETE_REFUSALS.missing;
    if (GLOB_CHARS.test(rel)) return DELETE_REFUSALS.glob;
    if (!lstatSync(join(root, rel)).isFile()) return DELETE_REFUSALS.missing;
    if (isTracked(root, rel)) return DELETE_REFUSALS.tracked;
    const hash = contentHashOf(root, rel);
    if (!toolWriteProves(root, rel, ANY_TIME_MS, hash)) return DELETE_REFUSALS.unrecorded;
    return toolWriteProves(root, rel, ANY_TIME_MS, hash, writer) ? DELETE_REFUSALS.otherWriter : '';
  } catch {
    return DELETE_REFUSALS.missing;
  }
}

export const ownsUntrackedFile = (root, rel, writer) => deleteRefusal(root, rel, writer) === '';
