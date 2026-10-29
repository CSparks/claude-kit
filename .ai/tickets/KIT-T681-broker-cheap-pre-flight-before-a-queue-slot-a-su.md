---
id: KIT-T681
title: broker: cheap pre-flight before a queue slot: a submit runs 'cargo check' of the touched crates against HEAD (or in a scratch target) and re
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:04:36Z
updated: 2026-10-28T22:04:36Z
---

## Description
broker: cheap pre-flight before a queue slot: a submit runs 'cargo check' of the touched crates against HEAD (or in a scratch target) and rejects compile errors before queueing; ~40% of today's dirt-empire jobs failed on compile/stale and each burned a full serial slot

kit-bug-shape: cap:feature:broker-cheap-pre-flight-before-a-queue-slot-a-su
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Data 2026-10-28 dirt-empire (241 jobs): 99 red/stale = 35 compile error, 47 test failure, 7 stale, 4 gate, 4 superseded. 28 of 35 compile errors surfaced in a scoped --test/-p command, i.e. the worker used the queue as its compiler (patch-worker.md: 'Do NOT run cargo... The broker builds' and 'Confident of a small change -> submit --land straight away'). Compile+stale jobs burned ~32 serial minutes. Pre-flight not built in this pass.
Ordering by the 2026-10-28 dirt-empire diagnosis: compile errors are 35 of 99 red/stale jobs, test failures 47; by volume the first lever is the batching window, then manifest split, then pin drop; pre-flight (this ticket) is the biggest lever on the compile share.
Not built. A pre-flight needs a source tree with the patch applied that is not the daemon's live checkout; in dirt-empire (bevy, rapid-game submodule) a separate target dir means a cold dependency build and a second tree is the dropped copy model. Upper bound on the gain: compile errors plus stale cost ~32 serial minutes on 2026-10-28. patch-worker.md now says the queue is not a compiler (check-only first, re-read symbols and other targets, keep patches disjoint) without claiming a pre-flight exists.

## History
- [2026-10-28 22:04] (created) feature — broker: cheap pre-flight before a queue slot: a submit runs 'cargo check' of the touched crates against HEAD (or in a scratch target) and re
