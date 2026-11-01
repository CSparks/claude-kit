---
id: KIT-T713
title: broker/KIT-D115: the one allowed wait is wasted when the job is not at the head of the queue (dirt-empire 2026-10-29: waits of 280 s routine
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T19:51:22Z
updated: 2026-10-29T19:51:22Z
---

## Description
broker/KIT-D115: the one allowed wait is wasted when the job is not at the head of the queue (dirt-empire 2026-10-29: waits of 280 s routinely end with the job still queued at position 3-6, and Chris sees agents 'waiting on a check job'). wait.mjs should refuse (exit at once with the queue position and an estimate) unless the job is running or next in line and its estimated finish is inside the window; the dispatch rule becomes: submit, handoff, end.

kit-bug-shape: cap:feature:broker-kit-d115-the-one-allowed-wait-is-wasted-w
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 19:51] (created) feature — broker/KIT-D115: the one allowed wait is wasted when the job is not at the head of the queue (dirt-empire 2026-10-29: waits of 280 s routine
