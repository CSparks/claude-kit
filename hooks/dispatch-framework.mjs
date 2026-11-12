// framework-checked — a check for dispatch-guard and plan-exit-gate (KIT-T1095). In a repo that uses a framework with a
// crate index, a plan and a plan or design brief name the indexed crates they read for each mechanism they propose:
// a need the framework already meets was designed twice because the plan was grounded on the crates the game calls.
//
//   frameworkFirstBlock({ root, subject, text, footer }) -> block message | null (check `framework-checked`)
//   frameworkBlock({ root, input, prompt, footer })       -> the same for a dispatch; asks plan and design dispatches only
//
// Escape: `[framework-checked: <indexed crates read, per mechanism>]` or `[framework-checked: none apply: <why>]`.
// A brief whose `[tree: <path>]` names another checkout is judged by that checkout's frameworks.

import { frameworksFor } from './lib/frameworks.mjs';
import { crateIndexFile, crateNames, frameworkCitationOk, frameworkFirstMessage } from './lib/framework-first.mjs';
import { isDesignDispatch } from './dispatch-rulings.mjs';
import { declaredTreeRoot } from './dispatch-target.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const FRAMEWORK_CHECK = 'framework-checked';
const TOKEN = TOKENS.frameworkChecked.pattern;

export function frameworkFirstBlock({ root, subject, text, footer }) {
  const said = TOKEN.exec(String(text || ''))?.[1]?.trim() || '';
  for (const framework of frameworksFor(root)) {
    const file = crateIndexFile(root, framework);
    if (!file) continue;
    if (!frameworkCitationOk(said, crateNames(file))) return frameworkFirstMessage({ subject, framework, names: crateNames(file), said, footer });
  }
  return null;
}

export function frameworkBlock({ root, input, prompt, footer }) {
  if (!isDesignDispatch(root, input, prompt)) return null;
  return frameworkFirstBlock({ root: declaredTreeRoot(input) || root, subject: 'plan or design brief', text: prompt, footer });
}
