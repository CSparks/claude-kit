// A shell segment that runs the kit's move-lines verb, judged by the files it names (KIT-T1159).
//
//   moveLinesCall(text, cwd) -> null | { problem, paths }
//     null     no segment word is named move-lines: the segment is no call
//     problem  '' when the call is the kit verb and its arguments pass move-lines/guard.mjs, else the reason; the gates treat
//              the call as a kit verb only then. The kit verb is the bare command `move-lines` (or `move-lines.mjs`), or
//              `node <script>` where the script is a move-lines.mjs sitting beside move-lines/plan.mjs; a program or script of
//              that name anywhere else is a scratch copy and never the verb.
//     paths    the source and every destination the call names, absolute ([] when the arguments could not be read)

import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseMoveLinesArgs } from '../../scripts/move-lines/args.mjs';
import { moveLinesProblem } from '../../scripts/move-lines/guard.mjs';
import { nodeScriptName } from './node-args.mjs';
import { shellArgs, toPath } from './shell-segments.mjs';

const VERB = /^move-lines(?:\.mjs)?$/i;
const SCRIPT = 'move-lines.mjs';
const PLAN_SIBLING = join('move-lines', 'plan.mjs');
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NOT_THE_VERB = 'this is not the kit verb: run the bare command move-lines';

const PATH_SEPARATOR = /[\\/]/;
const nameOf = (word) => basename(word).replace(/\.(?:exe|cmd|bat)$/i, '');

function isKitScript(path, cwd) {
  try {
    const real = realpathSync.native(resolve(cwd, toPath(path)));
    return basename(real) === SCRIPT && existsSync(join(dirname(real), PLAN_SIBLING));
  } catch { return false; }
}

// { args } for the kit verb, { impostor } for something named like it, null for any other command.
function readCall(words, cwd) {
  if (VERB.test(nameOf(words[0]))) return PATH_SEPARATOR.test(words[0]) ? { impostor: true } : { args: words.slice(1) };
  if (!/^node$/i.test(nameOf(words[0])) || nodeScriptName(words.slice(1)).toLowerCase() !== SCRIPT) return null;
  const at = words.findIndex((w, i) => i > 0 && nameOf(w).toLowerCase() === SCRIPT);
  return at > 0 && isKitScript(words[at], cwd) ? { args: words.slice(at + 1) } : { impostor: true };
}

export function moveLinesCall(text, cwd = process.cwd()) {
  const words = shellArgs(text);
  while (words.length && ENV_ASSIGN.test(words[0])) words.shift();
  const call = words.length ? readCall(words, cwd) : null;
  if (!call) return null;
  if (call.impostor) return { problem: NOT_THE_VERB, paths: [] };
  try {
    const { source, specs } = parseMoveLinesArgs(call.args, cwd);
    const dests = specs.map((s) => s.dest);
    return { problem: moveLinesProblem({ source, dests, cwd }), paths: [source, ...dests] };
  } catch (e) {
    return { problem: e.message, paths: [] };
  }
}
