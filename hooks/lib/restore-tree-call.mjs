// A shell segment that runs the kit's restore-tree verb (KIT-T1340): the verb that puts directories back to a revision and
// removes the files that revision lacks, so git's history, not the call, is the author of every byte it writes.
//
//   restoreTreeCall(text, cwd) -> boolean
//     True for the bare command `restore-tree` (or `restore-tree.mjs`), or `node <script>` where the script is a
//     restore-tree.mjs sitting beside restore-tree/plan.mjs; a program or script of that name anywhere else (a path
//     before the bare command, a scratch copy) is never the verb. Leading assignments are skipped.

import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { nodeScriptName } from './node-args.mjs';
import { shellArgs, toPath } from './shell-segments.mjs';

const VERB = /^restore-tree(?:\.mjs)?$/i;
const SCRIPT = 'restore-tree.mjs';
const PLAN_SIBLING = join('restore-tree', 'plan.mjs');
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const PATH_SEPARATOR = /[\\/]/;
const nameOf = (word) => basename(word).replace(/\.(?:exe|cmd|bat)$/i, '');

function isKitScript(path, cwd) {
  try {
    const real = realpathSync.native(resolve(cwd, toPath(path)));
    return basename(real) === SCRIPT && existsSync(join(dirname(real), PLAN_SIBLING));
  } catch { return false; }
}

export function restoreTreeCall(text, cwd = process.cwd()) {
  const words = shellArgs(text);
  while (words.length && ENV_ASSIGN.test(words[0])) words.shift();
  if (!words.length) return false;
  if (VERB.test(nameOf(words[0]))) return !PATH_SEPARATOR.test(words[0]);
  if (!/^node$/i.test(nameOf(words[0])) || nodeScriptName(words.slice(1)).toLowerCase() !== SCRIPT) return false;
  const at = words.findIndex((w, i) => i > 0 && nameOf(w).toLowerCase() === SCRIPT);
  return at > 0 && isKitScript(words[at], cwd);
}
