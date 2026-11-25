// Whether a caller may delete a file by shell: it is untracked and its bytes on disk are exactly what this caller's
// Edit or Write tool left (the accepted-writes ledger, tool-writes.mjs), with no other writer's tool having left them.
// A deletion writes nothing the pre-write checks could judge, so a scratch file the caller authored is its own to remove;
// tracked source, a file another session or agent wrote and a file changed since the tool left it stay with the gate.
//
//   deleteRefusal(root, rel, writer) -> '' when the caller may delete, else why not: one of DELETE_REFUSALS
//   ownsUntrackedFile(root, rel, writer) -> boolean   deleteRefusal(...) === ''; any failure answers false
//   ledgerRefusal(root, rel, writer) -> '' when the file's text (its bytes under LF or CRLF endings: git rewrites them when it
//     puts a stashed file back) is exactly what this writer's tool left and no other writer's
//     tool left them too, else unrecorded or other-writer (the part of a delete judgement every discard verb shares)
//   isTracked(root, rel) -> boolean

import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { contentHashVariants, toolWriteProves } from './tool-writes.mjs';

const ANY_TIME_MS = 0;
const GLOB_CHARS = /[*?[\]]/;

export const DELETE_REFUSALS = Object.freeze({
  noWriter: 'no-writer',
  glob: 'glob',
  missing: 'missing',
  tracked: 'tracked',
  unrecorded: 'unrecorded',
  otherWriter: 'other-writer',
  unresolved: 'unresolved',
  sweep: 'sweep',
  liveWriter: 'live-writer',
  incomplete: 'incomplete',
});

const UNMATCHED = /did not match any file/i;

// A failed git call counts as tracked: only git's own "did not match" answer proves the file is untracked.
export function isTracked(root, rel) {
  const found = gitTry(['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', rel], root);
  return found.ok || !UNMATCHED.test(found.out);
}

export function ledgerRefusal(root, rel, writer) {
  const hash = contentHashVariants(root, rel);
  if (!toolWriteProves(root, rel, ANY_TIME_MS, hash)) return DELETE_REFUSALS.unrecorded;
  return toolWriteProves(root, rel, ANY_TIME_MS, hash, writer) ? DELETE_REFUSALS.otherWriter : '';
}

export function deleteRefusal(root, rel, writer) {
  try {
    if (!writer) return DELETE_REFUSALS.noWriter;
    if (!root || !rel) return DELETE_REFUSALS.missing;
    if (GLOB_CHARS.test(rel)) return DELETE_REFUSALS.glob;
    if (!lstatSync(join(root, rel)).isFile()) return DELETE_REFUSALS.missing;
    if (isTracked(root, rel)) return DELETE_REFUSALS.tracked;
    return ledgerRefusal(root, rel, writer);
  } catch {
    return DELETE_REFUSALS.missing;
  }
}

export const ownsUntrackedFile = (root, rel, writer) => deleteRefusal(root, rel, writer) === '';
