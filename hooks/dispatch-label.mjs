#!/usr/bin/env node
// PreToolUse (Task|Agent) — every delegation carries its model on the call: the model the capability table assigns its
// job, and a description that starts with that model's tag (KIT-T179, KIT-T337, KIT-T897). exit 2 = block, 0 = allow.
//
// The call is never rewritten: a hook that changes a call after review makes auto mode's classifier refuse it. The
// block names every field to change and its exact value; a call already in the canonical form passes untouched.
// Applies in every repo, adopted or not. Fails open on any error.

import { payload, gitRoot } from './lib.mjs';
import { LABEL_CHECK, labelProblems } from './lib/dispatch-label.mjs';

try {
  const p = await payload();
  if (p.tool_input && typeof p.tool_input === 'object') {
    const problems = labelProblems(gitRoot(), p.tool_input, p);
    if (problems.length) {
      process.stderr.write([
        `BLOCKED: this delegation is not in the canonical form (${LABEL_CHECK}, KIT-T897). Change every field below, then resend once:`,
        ...problems.map((x) => `  - ${x.part}: ${x.wanted}`),
        '',
        'The hook never rewrites a call. Every requirement of a dispatch: q gates agent',
      ].join('\n'));
      process.exit(2);
    }
  }
} catch {
  /* fail open */
}
process.exit(0);
