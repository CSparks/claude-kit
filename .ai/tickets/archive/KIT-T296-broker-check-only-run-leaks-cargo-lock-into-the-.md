---
id: KIT-T296
title: broker check-only run leaks Cargo.lock into the live tree: a patch adding a dependency (stiletto crates/editor/Cargo.toml + rg-landform) lef
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T20:02:02Z
updated: 2026-10-27T22:27:25Z
---

## Description
broker check-only run leaks Cargo.lock into the live tree: a patch adding a dependency (stiletto crates/editor/Cargo.toml + rg-landform) left the resolved Cargo.lock change in the working copy after the failed run (job j-murdxmnf-qqrzf2), and the next job then paused on 'checkout dirty'. Restore mus

kit-bug-shape: cap:bug:broker-check-only-run-leaks-cargo-lock-into-the-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-02 20:02] (created) bug — broker check-only run leaks Cargo.lock into the live tree: a patch adding a dependency (stiletto crates/editor/Cargo.toml + rg-landform) lef
- [2026-10-13 19:50] (comment) @sonnet55: Already fixed by 776cb1c (T271) and 2a61906 (T306: every Cargo.lock journalled and restored, new locks dropped, deferred (full comment #1 in ## Notes)
### comment #1 [2026-10-13 19:50] @sonnet55
Already fixed by 776cb1c (T271) and 2a61906 (T306: every Cargo.lock journalled and restored, new locks dropped, deferred re-check guarded). Pinned the exact scenario in 60a51da: scripts/broker/lock-leak.test.mjs (failed dependency-adding run leaves tree clean, next job not paused); mutation (dropNewLocks disabled) fails it. npm test exit 0.
- [2026-10-13 19:50] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
