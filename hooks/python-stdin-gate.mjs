#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — refuse a python command that reads stdin when `python3` is the
// Windows Store stub (check-id python-stdin): the stub never returns and strands the shell. Names the
// node equivalents. exit 2 = block, 0 = allow. Applies in every repo; fails open on any error.

import { payload, excludeFooter } from './lib.mjs';
import { pythonStdinCommand } from './lib/python-stdin.mjs';

const CHECK = 'python-stdin';

try {
  const p = await payload();
  const found = pythonStdinCommand((p.tool_input && p.tool_input.command) || '');
  if (found) {
    process.stderr.write(`
BLOCKED: \`${found.name}\` here is the Microsoft Store stub; a command that feeds it stdin (\`-\`, a heredoc, a pipe) never returns
and leaves a shell that never exits.
  Use node instead:  node -e "<code>"   or write the script to a file and run  node file.mjs
  (a real Python install earlier on PATH than WindowsApps lifts this check.)
${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
