#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — while a broker daemon owns a checkout, a hand `rm` inside it
// races the daemon's restore journal. Deleting tracked files is a `*** delete` patch; clearing an
// untracked leftover (a stray __pycache__) is `broker.mjs clean`. This blocks the shell delete and
// names both (check-id tree-delete). No-ops without a live daemon and on unadopted repos; fails open.

import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { payload, gitRoot, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { treeDeleteTargets } from './lib/tree-delete.mjs';
import { blockingLane } from './dispatch-broker.mjs';

const CHECK = 'tree-delete';
try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const root = gitRoot();
  if (command && adopted(root)) {
    const targets = treeDeleteTargets(command, root, realpathSync.native(process.cwd())).filter((t) => !pathExcluded(root, CHECK, t));
    const lane = targets.length ? blockingLane('', root) : null;
    if (lane) {
      const shown = relative(root, targets[0]).split('\\').join('/');
      process.stderr.write(`
BLOCKED: a broker daemon owns this checkout (pid ${lane.held.pid}); a shell delete inside it races the daemon (${shown}).
  Untracked leftover (a stray __pycache__, a build product):  node "${join(import.meta.dirname, '..', 'scripts', 'broker', 'broker.mjs')}" clean ${shown} --root ${root}
  Every __pycache__ at once:                                   ... clean --pycache --root ${root}
  Tracked files:                                               a patch with  *** delete <path>  through the broker
${excludeFooter(CHECK)}`);
      process.exit(2);
    }
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
