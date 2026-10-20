---
id: KIT-T531
title: broker: a restart after an operator kill RE-RUNS the interrupted job with the same command ('restored the tree after interrupted job X; it r
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T20:43:25Z
updated: 2026-10-15T20:43:25Z
---

## Description
broker: a restart after an operator kill RE-RUNS the interrupted job with the same command ('restored the tree after interrupted job X; it re-runs'), even when the operator moved its queue file out and killed it precisely because the command was wrong (j-mv9y8xb8 ran the whole 1790-test stiletto suite twice, 50 min + 2 min). An interrupted job should be marked 'interrupted' in results and left for its owner to resubmit, never re-run automatically; and 'cancel <id>' must be able to withdraw an inflight job when no daemon is alive --priority high

kit-bug-shape: cap:bug:broker-a-restart-after-an-operator-kill-re-runs-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 20:43] (created) bug — broker: a restart after an operator kill RE-RUNS the interrupted job with the same command ('restored the tree after interrupted job X; it r
