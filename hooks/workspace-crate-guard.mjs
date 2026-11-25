#!/usr/bin/env node
// PostToolUse (Write|Edit) — an advisory, never a block (KIT-T1533). A file written inside a crate that a Cargo workspace takes
// as a member, where the crate has no src/lib.rs or src/main.rs (nor a src/bin or declared [lib]/[[bin]] target), is reported:
// every cargo command in the workspace fails to load until the target exists, for every writer sharing the tree.
// Ignore id: crate-target. Always exit 0, fails open.

import { dirname } from 'node:path';
import { payload, gitRootOfFile, projectRoot, pathExcluded, excludeFooter } from './lib.mjs';
import { crateMissingTarget } from './lib/crate-target-guard.mjs';

try {
  const p = await payload();
  const file = p.tool_input && (p.tool_input.file_path || p.tool_input.path);
  const missing = file ? crateMissingTarget(file) : null;
  if (missing && !pathExcluded(gitRootOfFile(file) || projectRoot(dirname(file)), 'crate-target', file)) {
    const text = [
      `WORKSPACE CRATE GUARD (advisory): ${missing.crate} is a member of the Cargo workspace ${missing.workspace} (members = "${missing.member}") but has no src/lib.rs, src/main.rs or declared [lib]/[[bin]] target.`,
      'Every cargo command in the workspace fails to load until the target exists, for every writer sharing the tree: write the crate\'s src/lib.rs (or src/main.rs) stub now.',
      excludeFooter('crate-target'),
    ].join('\n');
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
  }
} catch {
  /* an advisory never wedges a tool call */
}
process.exit(0);
