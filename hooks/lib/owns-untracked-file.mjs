// Whether a caller may delete a file by shell: it is untracked and its bytes on disk are exactly what this caller's
// Edit or Write tool left (the accepted-writes ledger, tool-writes.mjs), with no other writer's tool having left them.
// A deletion writes nothing the pre-write checks could judge, so a scratch file the caller authored is its own to remove;
// tracked source, a file another session or agent wrote and a file changed since the tool left it stay with the gate.
//
//   ownsUntrackedFile(root, rel, writer) -> boolean   false for an unknown writer; any failure answers false

import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { toolWriteProves } from './tool-writes.mjs';

const ANY_TIME_MS = 0;
const GLOB_CHARS = /[*?[\]]/;

const isTracked = (root, rel) => gitTry(['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', rel], root).ok;

export function ownsUntrackedFile(root, rel, writer) {
  try {
    if (!root || !rel || !writer || GLOB_CHARS.test(rel)) return false;
    if (!lstatSync(join(root, rel)).isFile() || isTracked(root, rel)) return false;
    const hash = contentHashOf(root, rel);
    return toolWriteProves(root, rel, ANY_TIME_MS, hash) && !toolWriteProves(root, rel, ANY_TIME_MS, hash, writer);
  } catch {
    return false;
  }
}
