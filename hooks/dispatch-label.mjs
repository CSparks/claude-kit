#!/usr/bin/env node
// PreToolUse (Task|Agent) — every delegation carries its model on the call: the model the capability table assigns its
// job, and a description that starts with that model's tag (KIT-T179, KIT-T337, KIT-T897). exit 2 = block, 0 = allow.
//
// The call is never rewritten: a hook that changes a call after review makes auto mode's classifier refuse it. The
// block names every field to change and its exact value; a call already in the canonical form passes untouched.
// Applies in every repo, adopted or not; dispatch-guard repeats these problems inside its own block (KIT-T898).
// Fails open on any error.

import { payload, gitRoot } from './lib.mjs';
import { labelBlockText, labelProblems } from './lib/dispatch-label.mjs';
import { triageFooter } from './lib/block-triage.mjs';

try {
  const p = await payload();
  if (p.tool_input && typeof p.tool_input === 'object') {
    const problems = labelProblems(gitRoot(), p.tool_input, p);
    if (problems.length) {
      process.stderr.write(`${labelBlockText(problems)}Every requirement of a dispatch, before you resend: q gates agent\n${triageFooter()}`);
      process.exit(2);
    }
  }
} catch {
  /* fail open */
}
process.exit(0);
