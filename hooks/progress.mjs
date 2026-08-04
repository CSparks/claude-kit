#!/usr/bin/env node
// PreToolUse/PostToolUse(Bash|PowerShell) + SubagentStop/Stop — publish what a session is
// COMPILING, live, to `.ai/agents-progress.jsonl` (KIT-T178).
//
// The failure it closes: a subagent runs `cargo test`, streams nothing for 30 minutes, and the
// orchestrator has no way to tell "compiling" from "hung" except tasklist/rustc forensics. Three
// complaints in one day (2026-08-04). Hooks fire inside subagent sessions — VERIFIED, not assumed
// (see hooks/README.md § Subagent progress) — so the start of the command IS the notification.
//
// PreToolUse writes the line, PostToolUse clears it, SubagentStop/Stop sweeps whatever the
// terminating session still owns. Three independent chances to clear one line, plus a staleness
// window in the reader, because a permanently-stuck "compiling" line is worse than none.
//
// ALWAYS exit 0. This hook observes; it never gates. A progress-write failure that blocked a
// build would be a strictly worse bug than the invisibility it fixes.

import { payload, gitRoot, adopted } from './lib.mjs';
import { matchLongRunning, progressKey, startProgress, endProgress, sweepProgress } from './progress-store.mjs';

const SWEEP_EVENTS = new Set(['SubagentStop', 'Stop']);

main().catch(() => process.exit(0));

async function main() {
  try {
    const p = await payload();
    const root = gitRoot();
    if (!adopted(root)) process.exit(0); // opt-in: a repo without .ai never grows a progress file
    const event = String(p.hook_event_name || '');
    const key = progressKey(p);

    if (SWEEP_EVENTS.has(event)) {
      sweepProgress(root, key);
      process.exit(0);
    }

    const command = (p.tool_input && p.tool_input.command) || '';
    const label = matchLongRunning(command);
    if (!label) process.exit(0); // not a long build — the overwhelming majority of Bash calls

    if (event === 'PostToolUse') endProgress(root, { key, command, label });
    else startProgress(root, { key, command, label, repo: root });
  } catch {
    /* fail-open — visibility is a nice-to-have; blocking a build never is */
  }
  process.exit(0);
}
