#!/usr/bin/env node
// PostToolUse (Bash|PowerShell|Grep|Glob) — search telemetry (KIT-T285). Logs one row per
// search-shaped call (q, code-graph, grep/rg, find, the Grep and Glob tools) to the per-project
// search log so the share of indexed lookups (q, code-graph) against raw greps can be tracked.
// Observes only: always exits 0, no output, fails open on any error. Gate blocks are logged by
// query-gate itself (a blocked call never reaches PostToolUse).

import { payload, gitRoot } from './lib.mjs';
import { classifyCalls } from './lib/search-shape.mjs';
import { logSearch } from './lib/search-log.mjs';
import { noteSearch } from './lib/q-miss.mjs';
import { basename } from 'node:path';

try {
  const p = await payload();
  const root = gitRoot();
  if (root) {
    for (const row of classifyCalls(p.tool_name, p.tool_input)) {
      logSearch(root, { session: p.session_id || '', ...row });
      await noteSearch(root, row, p.tool_response, basename(root));
    }
  }
} catch {
  /* never cost a tool call */
}
process.exit(0);
