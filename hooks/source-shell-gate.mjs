#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — source code changes through the Edit and Write tools, never a shell
// write. Blocks a redirect, tee, mv/rm/cp, sed/perl -i, PowerShell cmdlet, `node -e` or scratch script
// that writes a source file, because only Edit and Write run pre-write's length, comment and literal
// checks (check-id source-shell-write, KIT-T648). The store's twin is store-shell-gate.
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fails open on any error.

import { resolve } from 'node:path';
import { payload, gitRootOfFile, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { shellSourceWrite } from './lib/shell-source-write.mjs';
import { AMBIGUOUS_MESSAGE, toPath } from './lib/shell-segments.mjs';
import { commandCwd } from './lib/shell-cwd.mjs';

const CHECK = 'source-shell-write';
const UNEXPANDED = /^~|[$`*?[]/;

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const found = command ? shellSourceWrite(command) : null;
  // The written file's own repo (a relative path is relative to where the command `cd`s), not the hook's cwd.
  const cwd = found ? commandCwd(command) : '';
  const rootOf = (path) => gitRootOfFile(resolve(cwd, toPath(path)));
  const root = found ? rootOf(found.path) : '';
  // A move out of the repo to a destination the shell cannot expand is judged as staying.
  const leavesRepo = Boolean(found && found.movedTo) && !UNEXPANDED.test(found.movedTo) && rootOf(found.movedTo) !== root;
  if (found && adopted(root) && !leavesRepo) {
    if (!pathExcluded(root, CHECK, found.path)) {
      process.stderr.write(`
BLOCKED: ${found.ambiguous ? `a shell command may write a source file by hand. ${AMBIGUOUS_MESSAGE}` : `a shell command writes a source file by hand (${found.path}).`}
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
