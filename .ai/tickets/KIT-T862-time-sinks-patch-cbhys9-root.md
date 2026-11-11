---
id: KIT-T862
title: time sinks: patch-CBhYS9/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T23:24:06Z
updated: 2026-11-05T23:24:06Z
---

## Description
Ranked time sinks for patch-CBhYS9/root, waste first (rewritten each tick):
1. phase gate in patch-CBhYS9/root: 0.0 min, 27% of its phase time, 0.0 min/job, new (no earlier window), #1 (new)
2. phase push in patch-CBhYS9/root: 0.0 min, 26% of its phase time, 0.0 min/job, new (no earlier window), #2 (new)
3. phase commit in patch-CBhYS9/root: 0.0 min, 23% of its phase time, 0.0 min/job, new (no earlier window), #3 (new)
4. crate (workspace) in patch-CBhYS9/root: 0.0 min, 100% of its crate time, 0.0 min/job, new (no earlier window), #1 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:patch-CBhYS9|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:patch-CBhYS9/root
first seen in patch-CBhYS9. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-05 23:24] (created) bug — time sinks: patch-CBhYS9/root
