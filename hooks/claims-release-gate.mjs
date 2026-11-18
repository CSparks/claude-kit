#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — `claims --release` is the main thread's verb (KIT-T1287, KIT-T1288).
// SUBAGENT: a command whose de-quoted shell tokens name the claims script or shim with a release, or the release functions, is
// refused in any spelling (lib/claims-release-match.mjs). MAIN THREAD: a plain `claims --release <id>` is stamped, a one-use
// nonce exported to that command; scripts/claims.mjs refuses to run without it, so a spelling this hook misses still fails
// there (lib/claims-stamp.mjs). The roster and the claims decide whether the named agent has been quiet long enough.
// SUBAGENT, check-id hook-entry-run (KIT-T1357): a command that runs a kit hook entry point (lib/hook-entries.mjs) is
// refused: a hook takes its stdin as the harness's payload, so a made-up TaskStop piped into agent-roster.mjs would
// release another agent's claims. Only the harness runs hooks; tests spawn them from test files.
// Check-id claims-release. The block no-ops on unadopted repos; fails open.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { namesRelease, releaseTarget } from './lib/claims-release-match.mjs';
import { issueStamp, stampedCommand } from './lib/claims-stamp.mjs';
import { runsHookEntry } from './lib/hook-entries.mjs';

const CHECK = 'claims-release';
const HOOK_RUN_CHECK = 'hook-entry-run';

try {
  const p = await payload();
  const input = p.tool_input || {};
  const command = String(input.command || '');
  if (subagentId(p)) {
    const root = gitRoot();
    if (namesRelease(command, p.tool_name) && adopted(root) && !pathExcluded(root, CHECK, root)) {
      process.stderr.write(`\nBLOCKED: \`claims --release\` is the main thread's verb (KIT-T1287): a subagent cannot declare another agent dead.\nRaise it to the main thread, naming the agent id and why its claims should go.\n${excludeFooter(CHECK)}`);
      process.exit(2);
    }
    if (runsHookEntry(command, p.tool_name) && adopted(root) && !pathExcluded(root, HOOK_RUN_CHECK, root)) {
      process.stderr.write(`\nBLOCKED: this command runs a kit hook entry point (KIT-T1357). A hook takes its stdin as the harness's payload, so a subagent that feeds one acts with the harness's authority (a made-up TaskStop releases another agent's claims).\nOnly the harness runs hooks. To exercise one, write or run a test file that spawns it against throwaway state (CLAUDE_KIT_HOLDERS_DIR, CLAUDE_KIT_TURN_STATE); to read a gate's verdict, raise it to the main thread.\n${excludeFooter(HOOK_RUN_CHECK)}`);
      process.exit(2);
    }
  } else {
    const id = releaseTarget(command, p.tool_name);
    if (id) {
      const updated = { ...input, command: stampedCommand(command, p.tool_name, issueStamp(id)) };
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: updated } }));
    }
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
