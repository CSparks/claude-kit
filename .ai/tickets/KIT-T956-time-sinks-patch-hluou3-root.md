---
id: KIT-T956
title: time sinks: patch-HlUou3/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug, kit-queue]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:16:26Z
updated: 2026-11-10T18:16:26Z
---

## Description
Ranked time sinks for patch-HlUou3/root, waste first (rewritten each tick):
1. phase gate in patch-HlUou3/root: 0.1 min, 33% of its phase time, 0.1 min/job, new (no earlier window), #1 (new)
2. phase push in patch-HlUou3/root: 0.0 min, 22% of its phase time, 0.0 min/job, new (no earlier window), #2 (new)
3. phase commit in patch-HlUou3/root: 0.0 min, 22% of its phase time, 0.0 min/job, new (no earlier window), #3 (new)
4. crate (workspace) in patch-HlUou3/root: 0.0 min, 100% of its crate time, 0.0 min/job, new (no earlier window), #1 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:patch-HlUou3|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:patch-HlUou3/root
first seen in patch-HlUou3. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:16] (created) bug — time sinks: patch-HlUou3/root
