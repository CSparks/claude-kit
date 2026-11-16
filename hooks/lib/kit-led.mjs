// kit-led.mjs — whether a shell segment runs a kit verb (`q`, `cap`, `t`, `node <kit script>`), whose quoted arguments and flag
// values (`--path src/a.rs`) are data for the write scan, never a write target.
//
//   KIT_TOOL      the kit verbs and scripts by name
//   kitLed(segment, cwd) -> boolean
//     True for `q ...` or `node [flags] <kit script> ...`, never `node -e <code>` whatever the code names. A compound keyword,
//     `{`, `(` or env assignment before the verb is skipped (command-lead.mjs). A node script named by a bare variable
//     (`node "$Q" code x`, the kit's script held in a variable) counts, since the gate cannot read what the variable holds.
//     `move-lines` counts only when its arguments pass the move-lines guard from `cwd` (move-lines-call.mjs, KIT-T1159).

import { commandName, fromCommandWord } from './command-lead.mjs';
import { moveLinesCall } from './move-lines-call.mjs';
import { nodeScriptName } from './node-args.mjs';
import { shellArgs } from './shell-segments.mjs';

export const KIT_TOOL = /^(?:t|cap|rem|q|code-graph|t\.mjs|cap\.mjs|rem\.mjs|q\.mjs|index-tickets\.mjs|triage\.mjs|code-graph\.mjs)$/i;
const SCRIPT_VARIABLE = /^\$\{?\w+\}?$/;
const NODE = /^node$/i;

export function kitLed(segment, cwd = process.cwd()) {
  const text = fromCommandWord(segment);
  const move = moveLinesCall(text, cwd);
  if (move) return !move.problem;
  const args = shellArgs(text);
  if (!args.length) return false;
  const leader = commandName(args[0]);
  const script = NODE.test(leader) ? nodeScriptName(args.slice(1)) : '';
  return script ? KIT_TOOL.test(script) || SCRIPT_VARIABLE.test(script) : KIT_TOOL.test(leader);
}
