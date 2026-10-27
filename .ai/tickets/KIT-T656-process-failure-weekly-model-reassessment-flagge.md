---
id: KIT-T656
title: Process failure: weekly model reassessment flagged Fable 5.1 as 'unverified' because web search missed it, though the dispatching session's
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T22:00:39Z
updated: 2026-10-27T22:00:39Z
---

## Description
Process failure: weekly model reassessment flagged Fable 5.1 as 'unverified' because web search missed it, though the dispatching session's own system context lists claude-fable-5-1 as a current Anthropic model. Root cause: the reassessment brief has no grade-A anchor for the lineup, so a search miss reads as doubt. Fix: the orient brief passes the harness model list (or Anthropic's models page) as the authoritative lineup; model-refresh treats a search miss on a listed model as a search gap, never an exception.

kit-bug-shape: cap:bug:process-failure-weekly-model-reassessment-flagge
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-27 22:00] (created) bug — Process failure: weekly model reassessment flagged Fable 5.1 as 'unverified' because web search missed it, though the dispatching session's
