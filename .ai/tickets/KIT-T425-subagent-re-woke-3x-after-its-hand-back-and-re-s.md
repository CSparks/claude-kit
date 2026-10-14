---
id: KIT-T425
title: Subagent re-woke 3x after its hand-back and re-sent the same report each time (context-budget review ab036c14, 2026-10-12): it left a backgr
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T16:51:50Z
updated: 2026-10-12T16:51:50Z
---

## Description
Subagent re-woke 3x after its hand-back and re-sent the same report each time (context-budget review ab036c14, 2026-10-12): it left a background shell running, each completion re-invoked it, ~3k tokens per loop until the orchestrator TaskStopped it. Agents should stop their own background shells before hand-back, or the hand-back should end them.

kit-bug-shape: cap:bug:subagent-re-woke-3x-after-its-hand-back-and-re-s
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-12 16:51] (created) bug — Subagent re-woke 3x after its hand-back and re-sent the same report each time (context-budget review ab036c14, 2026-10-12): it left a backgr
- [2026-10-12 16:51] (comment) seen again in dirt-empire: Subagent re-woke 3x after its hand-back and re-sent the same report each time (context-budget review, 2026-10-12): it left a background shell running, each completion re-invoked it, until the orchestrator TaskStopped it. Agents should stop their own background shells before hand-back, or hand-back s
- [2026-10-12 16:51] (asked again) 2026-10-12 — cap:bug:subagent-re-woke-3x-after-its-hand-back-and-re-s
