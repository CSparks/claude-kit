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
updated: 2026-11-11T04:09:54Z
---

## Description
Ranked time sinks for dirt-empire/root, waste first (rewritten each tick):
1. waste slot queue caused by waste (estimate) in dirt-empire/root: 13.2 min, 41% of its waste time, 0.2 min/job, better (-48% per job), #2 unchanged
2. phase test in dirt-empire/root: 90.3 min, 35% of its phase time, 1.1 min/job, better (-67% per job), #2 (was #1)
3. phase compile in dirt-empire/root: 74.2 min, 29% of its phase time, 0.9 min/job, better (-69% per job), #3 (was #2)
4. crate dirt-empire in dirt-empire/root: 182.8 min, 82% of its crate time, 2.2 min/job, better (-58% per job), #1 unchanged
5. crate (workspace) in dirt-empire/root: 28.2 min, 13% of its crate time, 0.3 min/job, better (-85% per job), #3 (was #2)
6. test dirt-empire --test race in dirt-empire/root: 81.5 min, 42% of its test time, 1.0 min/job, worse (+25% per job), #1 (was #3)
7. test dirt-empire --test app in dirt-empire/root: 47.9 min, 24% of its test time, 0.6 min/job, better (-35% per job), #2 unchanged

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
