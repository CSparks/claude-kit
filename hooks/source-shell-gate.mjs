#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — source code changes through the Edit and Write tools, never a shell
// write. Blocks a redirect, tee, mv/rm/cp, sed/perl -i, PowerShell cmdlet, `node -e` or scratch script
// that writes a source file, because only Edit and Write run pre-write's length, comment and literal
// checks (check-id source-shell-write, KIT-T648). The store's twin is store-shell-gate.
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fails open on any error.

import { payload, gitRoot, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { shellSourceWrite } from './lib/shell-source-write.mjs';

const CHECK = 'source-shell-write';

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const root = gitRoot();
  if (command && adopted(root)) {
    const found = shellSourceWrite(command);
    if (found && !pathExcluded(root, CHECK, found.path)) {
      process.stderr.write(`
BLOCKED: a shell command writes a source file by hand (${found.path}).
  The pre-write gate (file length, comment prose, literals, rot markers) only sees the Edit and Write tools:
    Edit   change part of an existing file
    Write  create or replace a whole file
  A change too large for one Edit is a Write of the new file or several Edits, never a script.
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
${excludeFooter(CHECK)}`);
      process.exit(2);
    }
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
