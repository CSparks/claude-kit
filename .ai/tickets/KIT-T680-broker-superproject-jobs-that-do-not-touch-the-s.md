---
id: KIT-T680
title: broker: superproject jobs that do not touch the submodule should build/test while a submodule-lane job runs (today the root lane waits whene
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:04:34Z
updated: 2026-10-28T22:04:34Z
---

## Description
broker: superproject jobs that do not touch the submodule should build/test while a submodule-lane job runs (today the root lane waits whenever the rapid-game lane holds the rapid-game tree; dirt-empire 2026-10-28 21:46-21:53 five game jobs waited behind one failing 7-min framework check). Snapshot the pinned submodule tree for the root lane instead of sharing the live one.

kit-bug-shape: cap:feature:broker-superproject-jobs-that-do-not-touch-the-s
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Diagnosis 2026-10-28 (dirt-empire logs): by design, not a bug. subtree.mjs usesTree() makes every root job that runs cargo (all game jobs: the workspace builds over rapid-game path crates) take the rapid-game tree lock (KIT-T517/T559/T561), held for the whole submodule-lane job incl. its pre-push gate. Root-lane daemon logged 47 'waiting - rapid-game tree' periods, ~139 min total today (~25 min since 20:00Z; longest 12 min). docs/BROKER.md claimed lanes do not block (that sentence is about the dispatch guard only) - corrected. Fix needs the root lane to build against a snapshot of the pinned submodule sha; design only, not built (maintainer withdrew DE-D058 redesign).

## History
- [2026-10-28 22:04] (created) feature — broker: superproject jobs that do not touch the submodule should build/test while a submodule-lane job runs (today the root lane waits whene
