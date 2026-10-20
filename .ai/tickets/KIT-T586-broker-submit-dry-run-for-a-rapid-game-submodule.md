---
id: KIT-T586
title: broker submit dry-run for a rapid-game (submodule lane) job reads git show HEAD of the detached submodule worktree (pinned sha 60fb8fc), but
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T19:32:43Z
updated: 2026-10-20T00:52:09Z
fixed_commit: 6408069
---

## Description
broker submit dry-run for a rapid-game (submodule lane) job reads git show HEAD of the detached submodule worktree (pinned sha 60fb8fc), but the lane lands on main (ccecad6 ahead): a follow-up patch to files my own earlier landing changed is reported stale/not-found until a root-lane --pin moves the worktree. Dry-run should read the lane's main (the sha the apply phase uses). Seen 2026-10-19 DE-T049 L2.

kit-bug-shape: cap:bug:broker-submit-dry-run-for-a-rapid-game-submodule
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 19:32] (created) bug — broker submit dry-run for a rapid-game (submodule lane) job reads git show HEAD of the detached submodule worktree (pinned sha 60fb8fc), but
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) a submodule lane's submit dry run now reads the branch the daemon fast-forwards onto (scripts/broker/lane-ref.mjs); test scripts/broker/lane-ref.test.mjs (3 passed, negative control: a non-submodule lane still reads HEAD)
