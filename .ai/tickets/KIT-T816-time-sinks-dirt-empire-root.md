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
supersedes: KIT-T790
superseded_by:
created: 2026-11-01T22:36:05Z
updated: 2026-11-01T22:36:05Z
---

## Description
Ranked time sinks for dirt-empire/root, waste first (rewritten each tick):
1. waste scope rg-tool-asset-editor (all tests) in dirt-empire/root: 3.5 min, 18% of its waste time, 0.2 min/job, new (no earlier window), #1 (new)
2. waste scope rg-shader-kit (all tests) in dirt-empire/root: 3.5 min, 17% of its waste time, 0.2 min/job, new (no earlier window), #2 (new)
3. phase command in dirt-empire/root: 31.1 min, 50% of its phase time, 1.5 min/job, worse (+1292% per job), #1 (was #10)
4. phase test in dirt-empire/root: 14.9 min, 24% of its phase time, 0.7 min/job, better (-16% per job), #2 (was #5)
5. phase compile in dirt-empire/root: 10.1 min, 16% of its phase time, 0.5 min/job, better (-63% per job), #3 (was #2)
6. crate dirt-empire in dirt-empire/root: 32.6 min, 58% of its crate time, 1.6 min/job, better (-40% per job), #1 unchanged
7. crate race in dirt-empire/root: 4.1 min, 7% of its crate time, 0.2 min/job, worse (+254% per job), #2 (was #22)
8. crate rg-tool-asset-editor in dirt-empire/root: 3.5 min, 6% of its crate time, 0.2 min/job, new (no earlier window), #3 (new)
9. test dirt-empire --test bike in dirt-empire/root: 20.1 min, 38% of its test time, 1.0 min/job, better (-2% per job), #1 unchanged
10. test dirt-empire --test race in dirt-empire/root: 8.3 min, 16% of its test time, 0.4 min/job, worse (+42% per job), #2 (was #6)
11. test race (all tests) in dirt-empire/root: 4.1 min, 8% of its test time, 0.2 min/job, worse (+254% per job), #3 (was #29)

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
