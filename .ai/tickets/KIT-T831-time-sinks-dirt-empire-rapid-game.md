---
id: KIT-T831
title: time sinks: dirt-empire/rapid-game
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug, kit-queue]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T17:48:19Z
updated: 2026-11-11T04:09:54Z
---

## Description
Ranked time sinks for dirt-empire/rapid-game, waste first (rewritten each tick):
1. waste slot queue caused by waste (estimate) in dirt-empire/rapid-game: 20.6 min, 36% of its waste time, 0.7 min/job, new (no earlier window), #1 (new)
2. crate (workspace) in dirt-empire/rapid-game: 43.0 min, 25% of its crate time, 1.4 min/job, new (no earlier window), #2 (new)
3. test dirt-empire --test framework_conformance in dirt-empire/rapid-game: 16.6 min, 13% of its test time, 0.6 min/job, new (no earlier window), #3 (new)

A sink gets its own ticket only when someone starts fixing it: file it with shape broker-blocker:dirt-empire|rapid-game|<kind>|<key>; the tick then comments its rank there.

kit-bug-shape: broker-sinks:dirt-empire/rapid-game
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-02 17:48] (created) bug — time sinks: dirt-empire/rapid-game
