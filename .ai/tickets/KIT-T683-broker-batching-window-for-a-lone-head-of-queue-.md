---
id: KIT-T683
title: broker: batching window for a lone head-of-queue job (enforce-proper-use #1 by dirt-empire 2026-10-28 data: 150 of 190 non-train jobs ran al
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:26:53Z
updated: 2026-10-28T23:54:19Z
---

## Description
broker: batching window for a lone head-of-queue job (enforce-proper-use #1 by dirt-empire 2026-10-28 data: 150 of 190 non-train jobs ran alone because the queue held only themselves at start; jobs arrive minutes apart so the 2 s coalesce window never catches a peer). A head waits up to ~60 s (config batch_window_s) for train members when its shape is trainable; never when the lane is otherwise idle for a land job already green-cached; wait.mjs shows the window

kit-bug-shape: cap:feature:broker-batching-window-for-a-lone-head-of-queue-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: scripts/broker/batch-window.mjs, config batch_window_s (default 0 = off), batch-window.test.mjs 5 passed. Replay of 2026-10-28 dirt-empire results (247 jobs, serial worker per lane): no hold 238 builds, hold 60 s or 90 s 237 builds, median wait up; only 20 of 134 trainable jobs had a disjoint trainable peer within 60 s (36 within 5 min). Left OFF by default: the window buys ~1 build a day.

## History
- [2026-10-28 22:26] (created) feature — broker: batching window for a lone head-of-queue job (enforce-proper-use #1 by dirt-empire 2026-10-28 data: 150 of 190 non-train jobs ran al
- [2026-10-28 23:54] (status) todo → review
