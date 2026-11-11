---
id: KIT-T968
title: time sinks: patch-6vuC46/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug, kit-queue]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:58:45Z
updated: 2026-11-10T18:58:45Z
---

## Description
Ranked time sinks for patch-6vuC46/root, waste first (rewritten each tick):
1. phase gate in patch-6vuC46/root: 0.0 min, 34% of its phase time, 0.0 min/job, new (no earlier window), #1 (new)
2. phase push in patch-6vuC46/root: 0.0 min, 20% of its phase time, 0.0 min/job, new (no earlier window), #2 (new)
3. phase apply in patch-6vuC46/root: 0.0 min, 20% of its phase time, 0.0 min/job, new (no earlier window), #3 (new)
4. crate (workspace) in patch-6vuC46/root: 0.0 min, 100% of its crate time, 0.0 min/job, new (no earlier window), #1 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:patch-6vuC46|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:patch-6vuC46/root
first seen in patch-6vuC46. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:58] (created) bug — time sinks: patch-6vuC46/root
