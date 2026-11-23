// dispatch-compile-state.mjs — a brief for a writer-capable agent into a Cargo checkout where another writer is live, with no
// word on the compile state it leaves, is told to add one (KIT-T1510). Worktrees are forbidden, so the shared tree is the only
// isolation: one writer's mid-edit crate that does not compile blocks every other writer's builds. A warning, never a block.
//
//   compileStateWarning({ root, input, prompt, liveWriters }) -> '' | one NOTE line
//   COMPILE_STATE_CHECK                                       -> the check id, for the ignore file
// `liveWriters` is the count of other live writers in the target checkout; a brief that names `cargo check` or compiling carries the rule.

import { hasTrackedCargo } from '../scripts/broker/cargo-scope.mjs';
import { dispatchTargetRoot } from './dispatch-target.mjs';

export const COMPILE_STATE_CHECK = 'dispatch-compile-state';
const COMPILE_RULE = /\bcargo(?:\.exe)?\s+check\b|\bcompil(?:e|es|ed|ing)\b/i;

function isCargoTarget(root, input) {
  try { return hasTrackedCargo(dispatchTargetRoot(root, input)); } catch { return false; }
}

export function compileStateWarning({ root, input, prompt, liveWriters }) {
  if (!liveWriters || COMPILE_RULE.test(String(prompt || '')) || !isCargoTarget(root, input)) return '';
  return `NOTE: ${liveWriters} other writer(s) are live in this checkout and this brief says nothing about the compile state (KIT-T1510): a crate left mid-edit and not compiling blocks their builds. Add "end the turn with the crates you edited compiling (cargo check them)".`;
}
