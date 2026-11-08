---
id: KIT-T897
title: activity-tag rewrites Agent description prefix, model and prompt through updatedInput; auto mode's classifier refuses the call and its sibling calls (stiletto-2349 2026-11-08, KIT-D145/D147)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T18:51:36Z
updated: 2026-11-08T18:51:36Z
---

## Description
Hooks that mutate Agent input get the call refused by auto mode's classifier after review. Fix: activity-tag removed; dispatch-guard blocks with the exact canonical description, the model to pass, and nothing mutates the input. The no-wait rule moves into agents/patch-worker.md. Audit of other mutators: row-tag, broker-agent-tag, build-wrap (Bash). Related KIT-T894, KIT-T337, KIT-T179, KIT-T419.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a non-canonical Agent description prefix or a missing model is BLOCKED with the exact value to resend; a canonical call passes untouched; no hook returns updatedInput for Agent (hooks/dispatch-label.test.mjs 34 passed)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T894, KIT-T337, KIT-T179, KIT-T403
Evidence: 74 classifier refusals 'a hook changed this call's input after auto mode reviewed it' across local transcripts (scripts scratch scan of ~/.claude/projects), ALL for Agent; none for Bash/PowerShell/Monitor. Fix: hooks/activity-tag.mjs (mutated description prefix, model from the job table, appended the no-wait rule to a patch-worker prompt) is replaced by hooks/dispatch-label.mjs + hooks/lib/dispatch-label.mjs: blocks (exit 2), lists every field to change with its exact value, never writes input. The no-wait rule now lives in agents/patch-worker.md (hooks/dispatch-nowait.mjs removed; agent-context.test asserts the definition carries it). Other input mutators audited: row-tag (Bash/Monitor background rows: description tag + build-budget shim PATH), broker-agent-tag (subagent broker calls: --agent/--timeout flags + Bash timeout), build-wrap (foreground cargo: shim PATH). All three emit updatedInput on Bash/PowerShell/Monitor. No classifier refusal was found for any of them (0 of 74), and build-wrap/broker-agent-tag are functional rewrites (a block would make every cargo/broker call carry shims or flags by hand), so they are left as a listed hazard for the maintainer's call. Tests: dispatch-label 34, model-tag 64, agent-context 34, plugin-compat 143, dispatch-guard 43 pass + 3 stale-table failures that come from another session's uncommitted KIT-D143 hunk in hooks/dispatch-guard.mjs (not staged here).

## History
- [2026-11-08 18:51] (created) bug — activity-tag rewrites Agent description prefix, model and prompt through updatedInput; auto mode's classifier refuses the call and its sibling calls (stiletto-2349 2026-11-08, KIT-D145/D147)
- [2026-11-08 18:57] (comment) criterion added: a non-canonical Agent description prefix or a missing model is BLOCKED with the exact value to resend; a canonical call passes untouched; no hook returns updatedInput for Agent (hooks/dispatch-label.test.mjs 34 passed)
- [2026-11-08 18:57] (comment) ticked: a non-canonical Agent description prefix or a missing model is BLOCKED with the exact value to resend; a canonical call passes untouched; no hook returns updatedInput for Agent (hooks/dispatch-label.test.mjs 34 passed)
