---
id: KIT-T950
title: wait.mjs --timeout 280 is moved to the background by the Bash tool at 180s (tool timeout), so the patch-worker one allowed foreground wait b
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:49:44Z
updated: 2026-11-12T20:19:12Z
---

## Description
wait.mjs --timeout 280 is moved to the background by the Bash tool at 180s (tool timeout), so the patch-worker one allowed foreground wait becomes a background wait the broker-wait-gate forbids; the patch-worker prompt and skill say 280 but must say 170

kit-bug-shape: cap:bug:wait-mjs-timeout-280-is-moved-to-the-background-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Same root as KIT-T1104; fixed in 7d46b10: wait.mjs, the agent-tag default, the patch-worker agent and skill and the gate messages say 170 s.

## History
- [2026-11-10 17:49] (created) bug — wait.mjs --timeout 280 is moved to the background by the Bash tool at 180s (tool timeout), so the patch-worker one allowed foreground wait b
- [2026-11-12 20:18] (landed) 7d46b10 wait rule: the harness moves any foreground call to the background at 180 s whatever its timeout (measured with a 290 s
- [2026-11-12 20:19] (status) todo → review
- [2026-11-12 20:19] (comment) @claude-kit-agent: (fixed) 7d46b10, same root as KIT-T1104
- [2026-11-12 20:23] (landed) 5eb3e77 wait.mjs: the 180 s harness cap bounds only a subagent wait (always foreground); a main-thread wait keeps the window it 
