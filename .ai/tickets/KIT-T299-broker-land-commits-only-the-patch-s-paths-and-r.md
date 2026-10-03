---
id: KIT-T299
title: broker --land commits only the patch's paths and restores every Cargo.lock, so a patch that adds a dependency lands without the lockfile car
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T06:26:27Z
fixed_commit: cad11f3c3d6b63872e00624d13daab2fcf2b7eaa
updated: 2026-10-03T06:28:47Z
---

## Description
broker --land commits only the patch's paths and restores every Cargo.lock, so a patch that adds a dependency lands without the lockfile cargo resolved for it: main then builds with a stale Cargo.lock and the next build in the live checkout rewrites it, which dirties the tree and pauses the queue. S

kit-bug-shape: cap:bug:broker-land-commits-only-the-patch-s-paths-and-r
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A green landing commits every Cargo.lock the run changed (tracked-modified or new) with the patch paths
- [x] A landing that leaves the locks alone commits only the patch paths; check-only runs still restore locks byte for byte

## Plan
1.

## History
- [2026-10-03 06:26] (created) bug — broker --land commits only the patch's paths and restores every Cargo.lock, so a patch that adds a dependency lands without the lockfile car
- [2026-10-03 06:28] (comment) criterion added: A green landing commits every Cargo.lock the run changed (tracked-modified or new) with the patch paths
- [2026-10-03 06:28] (comment) criterion added: A landing that leaves the locks alone commits only the patch paths; check-only runs still restore locks byte for byte
- [2026-10-03 06:28] (comment) ticked: A green landing commits every Cargo.lock the run changed (tracked-modified or new) with the patch paths
- [2026-10-03 06:28] (comment) ticked: A landing that leaves the locks alone commits only the patch paths; check-only runs still restore locks byte for byte
- [2026-10-03 06:28] (status) todo → review
- [2026-10-03 06:28] (comment) @sonnet55: (fixed) cad11f3c3d6b63872e00624d13daab2fcf2b7eaa

## Notes
Fix cad11f3: `changedLocks(cwd)` in scripts/broker/git.mjs (locks from `lockFiles` with a non-empty `git status --porcelain`); scripts/broker/patch.mjs adds them to the landing paths. Tests: scripts/broker/land.test.mjs (lock rewritten -> committed incl. new sub/Cargo.lock; lock untouched -> only patch paths). Mutation: fix reverted -> the rewrite case fails (8 pass / 1 fail), restored -> `node --test "scripts/broker/*.test.mjs"` 50 passed.
