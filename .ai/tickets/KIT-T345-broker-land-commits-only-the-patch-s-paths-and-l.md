---
id: KIT-T345
title: broker land commits only the patch's paths and leaves cargo's Cargo.lock change uncommitted (dirty tree after a landing that added a depende
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T08:38:37Z
updated: 2026-10-27T21:36:04Z
---

## Description
broker land commits only the patch's paths and leaves cargo's Cargo.lock change uncommitted (dirty tree after a landing that added a dependency; dirt-empire 2026-10-06 j-muwezqz9 needed a follow-up lock-only landing abffac0). Landing should include Cargo.lock when the verify step changed it.

kit-bug-shape: cap:bug:broker-land-commits-only-the-patch-s-paths-and-l
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A landing whose manifests changed commits the Cargo.lock they resolve to

## Plan
1.

## Notes
2026-10-27 Already fixed, two commits: cad11f3 (KIT-T299: a landing commits every Cargo.lock the run changed, changedLocks in broker/git.mjs) and 7a3a9dc (KIT-T519: resolveLocks runs cargo metadata before the commit when a landed manifest changed, so a landing whose commands never touch the lock still carries it; the dirt-empire case abffac0 follow-up). Evidence: scripts/broker/land.test.mjs lock cases and scripts/broker/gate-lock.test.mjs 'real cargo: a manifest change lands with the lock its manifests resolve to' (2 passed). Mutation: resolveLocks call removed from patch.mjs -> that test fails (1 pass / 1 fail); restored. No new code. A publish ships nothing new here; daemons older than 7a3a9dc lack the fix.

## History
- [2026-10-06 08:38] (created) bug — broker land commits only the patch's paths and leaves cargo's Cargo.lock change uncommitted (dirty tree after a landing that added a depende
- [2026-10-27 21:35] (comment) criterion added: A landing whose manifests changed commits the Cargo.lock they resolve to
- [2026-10-27 21:36] (comment) ticked: A landing whose manifests changed commits the Cargo.lock they resolve to
- [2026-10-27 21:36] (status) todo → review
