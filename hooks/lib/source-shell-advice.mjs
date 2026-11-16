// source-shell-advice — the "what to do instead" paragraph of a source-shell-write block, one per kind of refusal.
//
//   WRITE_ADVICE     a hand write of source: use Write or Edit (vendoring route included)
//   LAUNCHER_ADVICE  a refused `builds --run` call: its usage form

import { VENDOR_ROUTE } from './vendor-route.mjs';
import { LAUNCHER_USAGE } from './builds-run-args.mjs';

export const WRITE_ADVICE = `  Use the Write tool: create or replace a whole file (a scratch repro or test is a Write too, never a heredoc,
  \`echo >\` or \`node -e\`). Use the Edit tool to change part of an existing file. Only these two run the
  pre-write gate (file length, comment prose, literals, rot markers).
  A change too large for one Edit is a Write of the new file or several Edits, never a script.
  Moving EXISTING lines into other files (a file split) is the kit verb: move-lines <source> <ranges>=<dest> ... (q gates source).
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
${VENDOR_ROUTE.map((line) => `  ${line}`).join('\n')}`;

export const LAUNCHER_ADVICE = `  The launcher call is judged as a whole; its exact form is:
    ${LAUNCHER_USAGE}
  --out is a path under target/ or the session scratchpad; --limit <n> is optional; the numbers are seconds. Nothing else
  (no --cwd: put "cd <dir> && ..." inside the quoted command). It runs the command in a process that outlives your turn,
  waits once in the same call, and its end is a line in target/broker/finished.log (docs/wait-rule.md).`;
