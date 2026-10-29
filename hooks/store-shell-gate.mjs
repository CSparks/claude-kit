#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — the work store changes through t, cap and rem, never through a
// shell write. Blocks a redirect, mv/rm/cp, sed -i, PowerShell cmdlet, `node -e` or scratch script
// that writes an .ai item, SESSION.md or a generated view, and names the verb that does it
// (check-id store-shell-write). The Write/Edit twin is pre-write's `store-write`.
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fails open on any error.

import { payload, gitRoot, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { shellStoreWrite } from './lib/store-shell-write.mjs';
import { AMBIGUOUS_MESSAGE } from './lib/shell-segments.mjs';

const CHECK = 'store-shell-write';

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const root = gitRoot();
  if (command && adopted(root)) {
    const found = shellStoreWrite(command);
    if (found && !pathExcluded(root, CHECK, found.path)) {
      process.stderr.write(`
BLOCKED: ${found.ambiguous ? `a shell command may write the .ai work store by hand. ${AMBIGUOUS_MESSAGE}` : `a shell command writes the .ai work store by hand (${found.path}).`}
  The store changes through its verbs, which mint ids, stamp history and refresh the cache:
    ${found.hint}
  A verb that cannot do what you need is a kit gap: cap feature "t: <what is missing>" --project claude-kit,
  then use the closest verb. Editing source code that merely mentions these paths: use the Edit tool.
${excludeFooter(CHECK)}`);
      process.exit(2);
    }
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
