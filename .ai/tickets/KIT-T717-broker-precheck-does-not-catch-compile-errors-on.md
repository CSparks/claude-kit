---
id: KIT-T717
title: broker precheck does not catch compile errors on rapid-game (submodule) lane jobs: j-mvu4zyvo-zssgvh (dirt-empire DE-T234, --repo rapid-game
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T22:52:47Z
updated: 2026-10-29T22:52:47Z
---

## Description
broker precheck does not catch compile errors on rapid-game (submodule) lane jobs: j-mvu4zyvo-zssgvh (dirt-empire DE-T234, --repo rapid-game) queued with a missing-import compile error in rg-probe-kit/src/schedule_times.rs and failed in its run; root-lane jobs are prechecked (e.g. j-mvu3ue3c rejected at submit in 24 s). Extend the precheck to submodule-lane jobs (cargo check in the lane's own workspace, rust/Cargo.toml).

kit-bug-shape: cap:bug:broker-precheck-does-not-catch-compile-errors-on
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 22:52] (created) bug — broker precheck does not catch compile errors on rapid-game (submodule) lane jobs: j-mvu4zyvo-zssgvh (dirt-empire DE-T234, --repo rapid-game
- [2026-10-30 19:36] (comment) @claude: Fixed with KIT-T729: precheck on a submodule repo now runs narrowCheck(..., { submodule }) from the job's cd directory,  (full comment #1 in ## Notes)
### comment #1 [2026-10-30 19:36] @claude
Fixed with KIT-T729: precheck on a submodule repo now runs narrowCheck(..., { submodule }) from the job's cd directory, drops the superproject --features and skips the whole-workspace stage (precheck-submodule.test.mjs 4 passed). Cause: all 16 rapid-game precheck logs in dirt-empire held 'cannot specify features for packages outside of workspace' and failed open.
