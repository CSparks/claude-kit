#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — refuse a python command that reads its program from an empty or absent
// stdin (check-id python-stdin; KIT-T699). On Windows an empty heredoc reaches python as NUL and CPython
// 3.14's pyrepl spins a full core forever; `python -` with no `<`, heredoc or pipe blocks forever on the Bash
// tool's stdin pipe; the Microsoft Store stub never returns. Names the node equivalents.
// exit 2 = block, 0 = allow. Applies in every repo; fails open on any error.

import { payload, excludeFooter } from './lib.mjs';
import { pythonStdinCommand } from './lib/python-stdin.mjs';

const CHECK = 'python-stdin';
const WHY = {
  'empty-heredoc': 'its heredoc has no body (bash hands python /dev/null, which Windows sees as NUL): CPython 3.14 starts its REPL and spins a full CPU core forever',
  'no-stdin': "it reads its program from stdin and nothing feeds it (no `<`, heredoc or pipe): it blocks forever on the tool's stdin pipe",
  'store-stub': 'it is the Microsoft Store stub, which never returns when fed stdin',
};

try {
  const p = await payload();
  const found = pythonStdinCommand((p.tool_input && p.tool_input.command) || '');
  if (found) {
    process.stderr.write(`
BLOCKED: \`${found.name}\` would hang this shell: ${WHY[found.reason]}.
  Use node instead:  node -e "<code>"   or write the script to a file and run  node file.mjs
  (python with a script file, \`-c\`, or a non-empty heredoc/pipe is fine.)
${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
