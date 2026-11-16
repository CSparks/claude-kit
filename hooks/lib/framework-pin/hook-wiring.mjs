// framework-pin/hook-wiring.mjs — the one line of the pin block that says whether a framework submodule's pre-push gate is
// wired (KIT-T1300). The framework tracks its gate in `.githooks/pre-push`; git runs it only once `core.hooksPath` points
// there, and a consumer's submodule checkout never has that set, so a push goes out ungated. Report-only, like the rest of the
// pin step: the line names the command, it sets nothing.
//
//   hookWiringLine(subDir) -> 'pre-push gate: wired' | 'pre-push gate: none tracked' | '!! pre-push gate ...' (not wired, or not checkable)

import { pushHookStatus, wireCommand } from '../push-hooks.mjs';

export function hookWiringLine(subDir) {
  try {
    const found = pushHookStatus(subDir);
    if (found.status === 'wired') return 'pre-push gate: wired';
    if (found.status === 'none') return 'pre-push gate: none tracked';
    return `!! pre-push gate NOT wired: ${found.hookDir}/pre-push is tracked but git skips it, so a push goes out ungated. Wire it: ${wireCommand(found.top, found.hookDir)}`;
  } catch (e) {
    return `!! pre-push gate could not be checked (${e.message})`;
  }
}
