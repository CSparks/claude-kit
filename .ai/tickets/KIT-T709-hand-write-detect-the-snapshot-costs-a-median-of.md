---
id: KIT-T709
title: hand-write-detect: the snapshot costs a median of 95 ms and 240 ms cold on dirt-empire (measured 2026-10-29, runtime e782b85), and PostToolU
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T19:23:15Z
updated: 2026-10-29T19:23:15Z
---

## Description
hand-write-detect: the snapshot costs a median of 95 ms and 240 ms cold on dirt-empire (measured 2026-10-29, runtime e782b85), and PostToolUse runs git status twice (hand-write-detect plus shell-writes). Share one status per tool call between the two hooks and cache it by tool_use_id. Target under 150 ms cold.

kit-bug-shape: cap:feature:hand-write-detect-the-snapshot-costs-a-median-of
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 19:23] (created) feature — hand-write-detect: the snapshot costs a median of 95 ms and 240 ms cold on dirt-empire (measured 2026-10-29, runtime e782b85), and PostToolU
