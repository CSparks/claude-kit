---
id: KIT-T998
title: process failure: orchestrator dispatched claude-kit:game-asset-artist with [job: asset] on a feature ticket without [escalate:]; dispatch-es
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:40:29Z
updated: 2026-11-11T03:40:29Z
---

## Description
process failure: orchestrator dispatched claude-kit:game-asset-artist with [job: asset] on a feature ticket without [escalate:]; dispatch-escalation blocked it (2026-11-10, marblequest). Root cause: q gates agent lists the escalate tag but not the job ids or which jobs outrank a ticket type's default; prevention: q gates agent prints the dispatch.jobs table (id, family) and the default job per ticket type.

kit-bug-shape: cap:bug:process-failure-orchestrator-dispatched-claude-k
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:40] (created) bug — process failure: orchestrator dispatched claude-kit:game-asset-artist with [job: asset] on a feature ticket without [escalate:]; dispatch-es
