---
id: KIT-T863
title: time sinks: patch-zai0Ez/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T23:32:53Z
updated: 2026-11-05T23:32:53Z
---

## Description
Ranked time sinks for patch-zai0Ez/root, waste first (rewritten each tick):
1. phase gate in patch-zai0Ez/root: 0.1 min, 46% of its phase time, 0.1 min/job, new (no earlier window), #1 (new)
2. phase commit in patch-zai0Ez/root: 0.0 min, 23% of its phase time, 0.0 min/job, new (no earlier window), #2 (new)
3. phase apply in patch-zai0Ez/root: 0.0 min, 14% of its phase time, 0.0 min/job, new (no earlier window), #3 (new)
4. crate (workspace) in patch-zai0Ez/root: 0.0 min, 100% of its crate time, 0.0 min/job, new (no earlier window), #1 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:patch-zai0Ez|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:patch-zai0Ez/root
first seen in patch-zai0Ez. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-05 23:32] (created) bug — time sinks: patch-zai0Ez/root
