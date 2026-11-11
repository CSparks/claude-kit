---
id: KIT-T880
title: Process failure: orchestrator asked for bill sign-off in prose (3 turns) instead of AskUserQuestion; Chris never saw it and the session idle
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:25:17Z
updated: 2026-11-07T17:25:17Z
---

## Description
Process failure: orchestrator asked for bill sign-off in prose (3 turns) instead of AskUserQuestion; Chris never saw it and the session idled with no pending question. Root cause: a READY decision (sign the bill) routed through prose; the anti-prose-decision rule exists but nothing blocks a turn that ends with a sign-off prose question. Want a Stop-hook check: turn ends with 'sign'/'your call'/'want me to' prose and no AskUserQuestion.

kit-bug-shape: cap:bug:process-failure-orchestrator-asked-for-bill-sign
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-07 17:25] (created) bug — Process failure: orchestrator asked for bill sign-off in prose (3 turns) instead of AskUserQuestion; Chris never saw it and the session idle
