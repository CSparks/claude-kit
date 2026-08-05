#!/usr/bin/env node
// PreToolUse (Task|Agent) — put the MODEL on the delegation's activity line (KIT-T179).
//
// The native line reads `general-purpose  Build CRX-T024 admin foundation`: the agent type is
// there, the tier that decides the bill is not. This hook rewrites the dispatch's `description`
// so it reads `general-purpose  [Opus 5] Build CRX-T024 admin foundation` — the one fact you
// need to catch a mis-tiered or silently-inherited delegation while it is still running.
//
// MECHANISM (verified against https://code.claude.com/docs/en/hooks §"PreToolUse decision
// control" on 2026-08-05, not assumed — the KIT-T177/T178 lesson): `updatedInput` under
// `hookSpecificOutput` is "an object with the same shape as tool_input, replacing the tool's
// arguments before it runs". It is a FULL replacement, hence the spread of the original input.
//
// It emits NO `permissionDecision` — deliberately. dispatch-guard fires on this same event and
// BLOCKS with exit 2; per the docs, omitting the field "is equivalent to defer", so this hook
// cannot promote a gate's deny into an allow. A cosmetic rewrite must never weaken a gate.
//
// FAIL-OPEN on everything: any throw, any unparseable payload, any unadopted repo exits 0 with
// no output, which the harness reads as "no opinion" and the dispatch proceeds untouched.

import { payload, gitRoot, adopted } from './lib.mjs';
import { resolveDispatchModel, modelDisplay, tagDescription } from './model-tag.mjs';

main().catch(() => process.exit(0));

async function main() {
  try {
    const p = await payload();
    const root = gitRoot();
    if (!adopted(root)) process.exit(0);

    const input = p.tool_input || {};
    const description = input.description;
    if (typeof description !== 'string' || !description.trim()) process.exit(0); // nothing to tag

    const display = modelDisplay(resolveDispatchModel(root, input, p));
    if (!display) process.exit(0); // model indeterminate — say nothing rather than guess a tier

    const tagged = tagDescription(description, display);
    if (tagged === description) process.exit(0); // already tagged — never rewrite for no reason

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: { ...input, description: tagged },
      },
    }));
  } catch {
    /* fail-open — a missing tag is cosmetic, a wedged dispatch is not */
  }
  process.exit(0);
}
