#!/usr/bin/env node
// PostToolUse (every tool) — tells the writer that last edited a crate marked broken that it does (KIT-T1245). The marker is
// written by crate-check when another writer's cargo check fails in the crate (lib/broken-crates.mjs); this hook delivers it
// to the writer named in it on that writer's next tool call, once per marker (exit 2 shows the message). It runs no build.
// Check-id crate-check. No-ops on unadopted repos and for a call with no session; fails open.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { brokenFor, culpritText, markTold } from './lib/broken-crates.mjs';
import { writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';

const CHECK = 'crate-check';

try {
  const p = await payload();
  const root = gitRoot();
  if (p.session_id && adopted(root) && !pathExcluded(root, CHECK, root)) {
    const writer = writerId(p.session_id, subagentId(p));
    const told = brokenFor(writer);
    if (told.length) {
      told.forEach((m) => markTold(m, writer));
      process.stderr.write(`\n${culpritText(told)}\n${excludeFooter(CHECK)}`);
      process.exit(2);
    }
  }
} catch {
  /* a notice never wedges a tool call */
}
process.exit(0);
