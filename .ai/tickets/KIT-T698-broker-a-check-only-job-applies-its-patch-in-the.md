---
id: KIT-T698
title: broker: a check-only job applies its patch in the maintainer's live checkout, so a hand cargo r compiles patched code (dirt-empire 2026-10-2
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T14:59:30Z
updated: 2026-10-29T14:59:30Z
---

## Description
broker: a check-only job applies its patch in the maintainer's live checkout, so a hand cargo r compiles patched code (dirt-empire 2026-10-29 14:49Z: j-mvtns65p-bsnum6 applied a DE-T209 phase B patch adding a look crate while Chris ran cargo r (target-play): E0117/E0603 that exist only in the patched tree). The maintainer's checkout must only hold landed code: check runs belong in a broker-owned check tree; only a land writes the live tree, and only code that already passed

kit-bug-shape: cap:bug:broker-a-check-only-job-applies-its-patch-in-the
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: check-tree.mjs (broker-owned git worktree per repo under target/broker/check, submodules as worktrees at the recorded sha, .ai junction), check-run.mjs (check-only jobs and the gate of a landing run there; the live tree is written once, by the landing, on the green evidence), train.mjs (trains build in the check tree and land from the live tree), live-patch.mjs (live tree: landed code only / PATCHED by <job>, shown by broker status and orient), phase.json removed when a job ends, subtree lock skipped for check-only jobs. Decision KIT-D114. Config check_tree (default on; false = old behaviour). Tests: check-tree.test.mjs 6, check-tree-train.test.mjs 3, check-tree-sub.test.mjs 2.

## History
- [2026-10-29 14:59] (created) bug — broker: a check-only job applies its patch in the maintainer's live checkout, so a hand cargo r compiles patched code (dirt-empire 2026-10-2
