// source-shell-advice — the "what to do instead" paragraph of a source-shell-write block, one per kind of refusal.
//
//   WRITE_ADVICE     a hand write of source: use Write or Edit (vendoring route included)
//   writeAdvice(found, file)  WRITE_ADVICE, led by the Edit (existing file) or Write (new file) call for the one file a hand write names
//   LAUNCHER_ADVICE  a refused `builds --run` call: its usage form

import { VENDOR_ROUTE } from './vendor-route.mjs';
import { existsSync } from 'node:fs';
import { editToolLine, writeToolLine } from './agent-gate-guide.mjs';
import { LAUNCHER_EXAMPLE, LAUNCHER_NOTES, LAUNCHER_USAGE, RUN_LIMIT_S } from './builds-run-usage.mjs';

export const WRITE_ADVICE = `  Use the Write tool: create or replace a whole file (a scratch repro or test is a Write too, never a heredoc,
  \`echo >\` or \`node -e\`). Use the Edit tool to change part of an existing file. Only these two run the
  pre-write gate (file length, comment prose, literals, rot markers).
  A change too large for one Edit is a Write of the new file or several Edits, never a script.
  Moving EXISTING lines into other files (a file split) is the kit verb: move-lines <source> <ranges>=<dest> ... (q gates source).
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
  A sweep over a data file (an A/B of a shipped asset such as world.ron) runs on a scratch asset root under target/
  (KIT-T1360): copy the assets there (cp -r assets target/sweep-assets writes only build output), point the program at
  the copy (Bevy reads BEVY_ASSET_ROOT; otherwise the env var or flag the program names), and change the copy with Edit
  or Write. Never rewrite the shipped file from the shell. Spell cp, rm and redirect paths out as literals: a $VAR operand
  is judged as a source write. A scratch folder under target/ is build output: rm -r target/<dir> with the literal path passes.
${VENDOR_ROUTE.map((line) => `  ${line}`).join('\n')}`;

// A hand write of one file leads with the call for exactly that file: Edit for a file that exists, Write for one it would
// create. A delete, a sweep or an ambiguous call has no such file.
export function writeAdvice(found, file) {
  const oneFile = file && !found.deletes && !found.sweep && !found.ambiguous && !found.moveLinesProblem;
  if (!oneFile) return WRITE_ADVICE;
  const path = String(file).replace(/\\/g, '/');
  return `  Instead, call ${existsSync(file) ? editToolLine(path) : writeToolLine(path)}\n${WRITE_ADVICE}`;
}

export const LAUNCHER_ADVICE = `  The launcher call is judged as a whole; its exact form is:
    ${LAUNCHER_USAGE}
  Example:
    ${LAUNCHER_EXAMPLE}
${LAUNCHER_NOTES.map((line) => `  ${line}`).join('\n')}
  --limit <n> is optional (over ${RUN_LIMIT_S.DEFAULT} it needs --why "<reason>"); the numbers are seconds. Nothing else
  (no --cwd: put "cd <dir> && ..." inside the quoted command). It runs the command in a process that outlives your turn,
  waits once in the same call, and its end is a line in target/broker/finished.log (docs/wait-rule.md).`;
