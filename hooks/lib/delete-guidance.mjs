// What source-shell-gate tells a caller whose shell delete of a source file was refused (owns-untracked-file.mjs): the
// rule, then the one way out that fits why this file was refused.
//
//   DELETE_RULE                                 the rule in one sentence (also printed by `q gates source`)
//   deleteGuidance(refusal, { path, cwd })      the lines for a refusal in DELETE_REFUSALS; '' for an unknown refusal

import { resolve } from 'node:path';
import { DELETE_REFUSALS as R } from './owns-untracked-file.mjs';

export const DELETE_RULE = 'a shell delete (rm, del, Remove-Item) of source passes only for an untracked file this caller wrote with Write or Edit and has not changed since, one named file per operand; a tracked file is removed with `git rm -- <path>`; an untracked file another session or agent wrote is left to its writer (no shell verb is sanctioned for it: raise it to the main thread)';

const WAYS_OUT = {
  [R.noWriter]: () => 'This call carries no session id, so no Write can be attributed to it.',
  [R.glob]: () => 'A glob is not expanded: name each file.',
  [R.missing]: ({ path, cwd }) => `No such file at ${resolve(cwd, path).replace(/\\/g, '/')}: the command is in ${cwd.replace(/\\/g, '/')} at this point (a \`cd\` earlier in the command moves where a relative path points).`,
  [R.tracked]: ({ path }) => `Tracked source: remove it with \`git rm -- ${path}\`, so the commit shows the deletion.`,
  [R.unrecorded]: () => 'No Edit or Write of this caller left these bytes (never written by a tool, or changed since): it stays with its writer; raise it to the main thread.',
  [R.otherWriter]: () => 'Another session or agent wrote this file: it stays with its writer; raise it to the main thread. No shell verb is sanctioned for it.',
};

export function deleteGuidance(refusal, ctx) {
  const wayOut = WAYS_OUT[refusal];
  return wayOut ? `  Delete rule: ${DELETE_RULE}.\n  ${wayOut(ctx)}\n` : '';
}
