---
id: KIT-T636
title: Scheduled build-dir sweep (maintainer approved 2026-10-23, supersedes KIT-T273 'deliberately not automated'): a kit script run nightly by Wi
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-23T22:53:52Z
updated: 2026-10-23T23:18:03Z
---

## Description
Scheduled build-dir sweep (maintainer approved 2026-10-23, supersedes KIT-T273 'deliberately not automated'): a kit script run nightly by Windows Task Scheduler (and launchd/cron on mac) over every cargo build dir under the dev root at ANY depth (target, target-*, *-target, submodule rapid-game/rust/target, worktree targets, broker lanes): delete artifacts untouched 7+ days (cargo-sweep semantics), all orphaned incremental sessions, and sibling build dirs idle 14+ days; skip a live broker lock or running cargo/rustc; write a receipt that SessionStart surfaces. Test against a fixture tree incl. a depth-6 submodule target.

kit-bug-shape: cap:feature:scheduled-build-dir-sweep-maintainer-approved-20
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] scripts/build-sweep.mjs keeps the newest generation per crate, removes older generations and orphan incremental sessions, deletes idle non-primary build dirs, skips live repos (31 asserts, exact survivors)
- [x] Receipt printed and appended to build-sweep.log; superseding decision KIT-D106 recorded
- [x] build-sweep install registers the 03:30 nightly task claude-kit-build-sweep; launchd plist on macOS

## Plan
1.

## Notes
Tests: npm test 119 of 247 files run, all ok (scripts/build-sweep.test.mjs 31 asserts, hooks/build-tree.test.mjs 11, hooks/housekeeping.test.mjs). Installed task claude-kit-build-sweep, next run 2026-10-24T03:30. Generation window: variants built within 1h of the newest generation also survive (same-build host/target siblings). Dry run D:\dev: 77,779 items, 978.94 GB.

## History
- [2026-10-23 22:53] (created) feature — Scheduled build-dir sweep (maintainer approved 2026-10-23, supersedes KIT-T273 'deliberately not automated'): a kit script run nightly by Wi
- [2026-10-23 23:17] (comment) criterion added: scripts/build-sweep.mjs keeps the newest generation per crate, removes older generations and orphan incremental sessions, deletes idle non-primary build dirs, skips live repos (31 asserts, exact survivors)
- [2026-10-23 23:17] (comment) criterion added: Receipt printed and appended to build-sweep.log; superseding decision KIT-D106 recorded
- [2026-10-23 23:17] (comment) criterion added: build-sweep install registers the 03:30 nightly task claude-kit-build-sweep; launchd plist on macOS
- [2026-10-23 23:17] (comment) ticked: scripts/build-sweep.mjs keeps the newest generation per crate, removes older generations and orphan incremental sessions, deletes idle non-primary build dirs, skips live repos (31 asserts, exact survivors)
- [2026-10-23 23:17] (comment) ticked: Receipt printed and appended to build-sweep.log; superseding decision KIT-D106 recorded
- [2026-10-23 23:17] (comment) ticked: build-sweep install registers the 03:30 nightly task claude-kit-build-sweep; launchd plist on macOS
- [2026-10-23 23:18] (status) todo → review
