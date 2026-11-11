---
id: KIT-T950
title: wait.mjs --timeout 280 is moved to the background by the Bash tool at 180s (tool timeout), so the patch-worker one allowed foreground wait b
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:49:44Z
updated: 2026-11-10T17:49:44Z
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

## History
- [2026-11-10 17:49] (created) bug — wait.mjs --timeout 280 is moved to the background by the Bash tool at 180s (tool timeout), so the patch-worker one allowed foreground wait b
