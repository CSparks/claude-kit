#!/usr/bin/env node
// SessionStart — report the framework pin of a consumer project (KIT-D141, KIT-T891 slice 1): pin, origin/main,
// the delta, may-break crates, a conflict forecast. Report-only: it writes no tree. Silent outside a consumer.
// CLAUDE_KIT_PIN_FETCH=0 skips the fetch. Fail-open: any error prints nothing and exits 0.

import { gitRoot } from './lib/paths.mjs';

try {
  const root = gitRoot();
  if (root) {
    const { frameworkPinReport } = await import('./lib/framework-pin.mjs');
    const report = await frameworkPinReport(root, { fetch: process.env.CLAUDE_KIT_PIN_FETCH !== '0' });
    if (report) process.stdout.write(`${report}\n`);
  }
} catch {
  /* the report is best-effort — never break orientation */
}
process.exit(0);
