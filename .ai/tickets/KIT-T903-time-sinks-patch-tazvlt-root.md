---
id: KIT-T903
title: time sinks: patch-TaZvLT/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug, kit-queue]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T19:52:50Z
updated: 2026-11-08T19:52:50Z
---

## Description
Ranked time sinks for patch-TaZvLT/root, waste first (rewritten each tick):
1. phase gate in patch-TaZvLT/root: 0.0 min, 30% of its phase time, 0.0 min/job, new (no earlier window), #1 (new)
2. phase push in patch-TaZvLT/root: 0.0 min, 30% of its phase time, 0.0 min/job, new (no earlier window), #2 (new)
3. phase apply in patch-TaZvLT/root: 0.0 min, 19% of its phase time, 0.0 min/job, new (no earlier window), #3 (new)
4. crate (workspace) in patch-TaZvLT/root: 0.0 min, 100% of its crate time, 0.0 min/job, new (no earlier window), #1 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:patch-TaZvLT|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:patch-TaZvLT/root
first seen in patch-TaZvLT. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-08 19:52] (created) bug — time sinks: patch-TaZvLT/root
