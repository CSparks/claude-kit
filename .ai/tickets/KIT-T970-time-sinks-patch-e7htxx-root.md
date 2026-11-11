---
id: KIT-T970
title: time sinks: patch-E7hTxx/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug, kit-queue]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T19:03:42Z
updated: 2026-11-10T19:03:42Z
---

## Description
Ranked time sinks for patch-E7hTxx/root, waste first (rewritten each tick):
1. phase gate in patch-E7hTxx/root: 0.0 min, 32% of its phase time, 0.0 min/job, new (no earlier window), #1 (new)
2. phase commit in patch-E7hTxx/root: 0.0 min, 26% of its phase time, 0.0 min/job, new (no earlier window), #2 (new)
3. phase push in patch-E7hTxx/root: 0.0 min, 20% of its phase time, 0.0 min/job, new (no earlier window), #3 (new)
4. crate (workspace) in patch-E7hTxx/root: 0.0 min, 100% of its crate time, 0.0 min/job, new (no earlier window), #1 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:patch-E7hTxx|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:patch-E7hTxx/root
first seen in patch-E7hTxx. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 19:03] (created) bug — time sinks: patch-E7hTxx/root
