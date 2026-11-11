---
id: KIT-T963
title: hand-write-detect (KIT-T706) flags git stash / git stash pop / git checkout as a hand write: the PostToolUse hook attributes files git rewro
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T982
created: 2026-11-10T18:50:13Z
updated: 2026-11-10T18:50:13Z
---

## Description
hand-write-detect (KIT-T706) flags git stash / git stash pop / git checkout as a hand write: the PostToolUse hook attributes files git rewrote on disk to the shell call and blocks the commit until they are re-saved through Edit. Repro 2026-11-10 in hustle-or-die: git stash push -- rust/hod-game rust/hod-physics, then git stash pop, each flagged five source files. Expected: ignore changes whose tracked content equals a git object (stash/checkout/pull/merge/reset), or whose command is a git command.

kit-bug-shape: cap:bug:hand-write-detect-kit-t706-flags-git-stash-git-s
first seen in hustle-or-die. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:50] (created) bug — hand-write-detect (KIT-T706) flags git stash / git stash pop / git checkout as a hand write: the PostToolUse hook attributes files git rewro
- [2026-11-11 02:21] (status) todo → superseded (by KIT-T982)
