---
id: KIT-T296
title: broker check-only run leaks Cargo.lock into the live tree: a patch adding a dependency (stiletto crates/editor/Cargo.toml + rg-landform) lef
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T20:02:02Z
updated: 2026-10-02T20:02:02Z
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
