// What source-shell-gate decides about a hit that removes or hides files: a shell delete (rm, del, Remove-Item), a
// git call that does the same (git-discards.mjs), an operand a variable or substitution supplies that the command does
// not resolve (shell-write-scan.mjs), and a git call that may take files it does not name.
//
//   deleteJudgement(found, root, rel, caller) -> '' when the caller may, else why not: one of DELETE_REFUSALS
//     found:  the hit; `unresolved` is the operand text, `sweep` the operand a git call leaves wide, `discard` the git verb
//             that names one file, `deletes` a plain delete
//     rel:    the hit's path inside `root`; caller: the writer id of the call (tool-writes.mjs writerId)
//
// A named file passes only when the caller's own Edit or Write left its bytes (owns-untracked-file.mjs); a tracked file
// a git verb would take with local changes counts the same way, and one identical to HEAD loses nothing. A call that may
// take unnamed files passes only while no other writer is live in the checkout (checkout-holder.mjs).

import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { liveClaimants, liveHolders } from './checkout-holder.mjs';
import { gitTry } from './exec.mjs';
import { DELETE_REFUSALS as R, deleteRefusal, isTracked, ledgerRefusal } from './owns-untracked-file.mjs';
import { writerId, writerSession } from './tool-writes.mjs';

const CLEAN_VERB = 'git clean';

const otherLiveWriters = (root, caller) => liveClaimants(root).some((e) => writerId(e.session, e.agent) !== caller)
  || liveHolders(root).some((h) => h.session !== writerSession(caller));

const matchesHead = (root, rel) => gitTry(['--literal-pathspecs', 'diff', '--quiet', 'HEAD', '--', rel], root).ok;

function discardRefusal(root, rel, caller, verb) {
  try {
    if (!root || !rel) return R.missing;
    if (isTracked(root, rel)) return verb === CLEAN_VERB || matchesHead(root, rel) ? '' : ledgerOrNone(root, rel, caller);
    if (!lstatSync(join(root, rel)).isFile()) return R.missing;
    return ledgerOrNone(root, rel, caller);
  } catch {
    return R.missing;
  }
}

const ledgerOrNone = (root, rel, caller) => (caller ? ledgerRefusal(root, rel, caller) : R.noWriter);

export function deleteJudgement(found, root, rel, caller) {
  if (found.unresolved) return R.unresolved;
  if (found.sweep) return otherLiveWriters(root, caller) ? R.sweep : '';
  if (found.discard) return discardRefusal(root, rel, caller, found.discard);
  return found.deletes ? deleteRefusal(root, rel, caller) : '';
}
