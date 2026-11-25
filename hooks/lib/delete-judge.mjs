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
// take unnamed files passes only while no other writer is live in the checkout (live-writers.mjs).
//
// The main thread answers to the maintainer, so its plain delete (never a git discard verb) of an untracked file that
// another writer wrote, or no tool wrote, passes once no live writer holds the file (KIT-T1246): none claims it, none
// listed it dirty, none left its bytes. A file with no recorded writer also waits while any other writer is live. An
// unreadable registry keeps the refusal. A subagent never gets this lift. deleteJudgement throws when the registry of a
// sweep cannot be read; source-shell-gate refuses what it could not judge.

import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { liveWritersFor, fileHolders, otherLiveWriters } from './live-writers.mjs';
import { DELETE_REFUSALS as R, deleteRefusal, isTracked, ledgerRefusal } from './owns-untracked-file.mjs';
import { isMainThread } from './tool-writes.mjs';

const CLEAN_VERB = 'git clean';
// A registry that cannot be read throws, and the caller refuses: "no writer seen" is never "no writer live" (KIT-T1271).
const STRICT_REGISTRY = Object.freeze({ strict: true });
const LIFTED_FOR_MAIN_THREAD = new Set([R.unrecorded, R.otherWriter]);

// The lift needs proof that no writer is live; a registry that cannot be read proves nothing, so any throw keeps the refusal.
function mainThreadDelete(root, rel, caller, refusal) {
  if (!LIFTED_FOR_MAIN_THREAD.has(refusal) || !isMainThread(caller)) return refusal;
  try {
    const holders = refusal === R.unrecorded ? liveWritersFor(root, rel, caller) : fileHolders(root, rel, caller);
    return holders.length ? R.liveWriter : '';
  } catch {
    return refusal;
  }
}

// The main thread may `git restore -- <named tracked file>` (the plain form) when only a dead or ended writer left the changes:
// no live writer holds the file. A subagent, any other verb and a registry that cannot be read keep the refusal (KIT-T1286).
// Changes no tool recorded (the maintainer's own edit) are never lifted: only another writer's recorded bytes are.
const RESTORE_VERB = 'git restore';
function mainThreadRestore(verb, root, rel, caller, refusal) {
  if (verb !== RESTORE_VERB || refusal !== R.otherWriter || !isMainThread(caller)) return refusal;
  try {
    return fileHolders(root, rel, caller).length ? R.liveWriter : '';
  } catch {
    return refusal;
  }
}

const matchesHead =(root, rel) => gitTry(['--literal-pathspecs', 'diff', '--quiet', 'HEAD', '--', rel], root).ok;

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
  if (found.sweep) return found.always || otherLiveWriters(root, caller, STRICT_REGISTRY).length ? R.sweep : '';
  if (found.discard) return mainThreadRestore(found.discard, root, rel, caller, discardRefusal(root, rel, caller, found.discard));
  return found.deletes ? mainThreadDelete(root, rel, caller, deleteRefusal(root, rel, caller)) : '';
}
