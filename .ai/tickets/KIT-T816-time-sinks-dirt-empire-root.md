---
id: KIT-T816
title: time sinks: dirt-empire/root
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug, kit-queue]
links: []
files: []
supersedes: KIT-T815
superseded_by:
created: 2026-11-01T22:36:05Z
updated: 2026-11-02T16:48:18Z
---

## Description
Ranked time sinks for dirt-empire/root, waste first (rewritten each tick):
1. waste repeat test->test different flags in dirt-empire/root: 8.9 min, 27% of its waste time, 0.4 min/job, worse (+906% per job), #1 (was #3)
2. waste scope rg-tool-asset-editor (all tests) in dirt-empire/root: 3.5 min, 11% of its waste time, 0.1 min/job, new (no earlier window), #2 (new)
3. phase compile in dirt-empire/root: 38.2 min, 52% of its phase time, 1.5 min/job, worse (+16% per job), #1 unchanged
4. phase test in dirt-empire/root: 27.9 min, 38% of its phase time, 1.1 min/job, better (-13% per job), #2 unchanged
5. phase baseline in dirt-empire/root: 3.7 min, 5% of its phase time, 0.1 min/job, better (-86% per job), #3 unchanged
6. crate dirt-empire in dirt-empire/root: 38.7 min, 58% of its crate time, 1.5 min/job, better (-35% per job), #1 unchanged
7. crate (workspace) in dirt-empire/root: 7.1 min, 11% of its crate time, 0.3 min/job, worse (+1% per job), #2 (was #3)
8. crate race in dirt-empire/root: 4.1 min, 6% of its crate time, 0.2 min/job, new (no earlier window), #3 (new)
9. test dirt-empire --test bike in dirt-empire/root: 23.9 min, 40% of its test time, 1.0 min/job, better (-20% per job), #1 unchanged
10. test dirt-empire --test race in dirt-empire/root: 10.6 min, 18% of its test time, 0.4 min/job, worse (+4% per job), #2 (was #4)
11. test race (all tests) in dirt-empire/root: 4.1 min, 7% of its test time, 0.2 min/job, new (no earlier window), #3 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:dirt-empire|root|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:dirt-empire/root
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-01 22:36] (created) bug — time sinks: dirt-empire/root
- [2026-11-01 23:29] (comment) @infra: KIT-T812..T815 superseded into this ticket: the old per-sink tick filed them at 22:33Z, five minutes before 0b1b982 published, so the step-1 migration missed them.
