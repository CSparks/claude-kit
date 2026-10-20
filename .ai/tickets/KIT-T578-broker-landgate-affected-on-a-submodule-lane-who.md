---
id: KIT-T578
title: broker landgate (affected) on a submodule lane whose Cargo workspace is in a subdir (dirt-empire rapid-game: rust/): landGate builds "<affec
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T04:45:11Z
updated: 2026-10-19T04:45:11Z
---

## Description
broker landgate (affected) on a submodule lane whose Cargo workspace is in a subdir (dirt-empire rapid-game: rust/): landGate builds "<affected.test> -p rg-physics --lib --test ..." with no cd, so it runs in the superproject workspace and fails "package rg-physics cannot be tested because it requires dev-dependencies and is not a member of the workspace" (job j-mveqp0nr-3g1q0i); every rapid-game --land from dirt-empire is unlandable. Fix: landgate prefixes the lane workspace dir (repo gate_prebuild cd target or a repo workspace: key) like lane-cargo.mjs requires of worker commands

kit-bug-shape: cap:bug:broker-landgate-affected-on-a-submodule-lane-who
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 04:45] (created) bug — broker landgate (affected) on a submodule lane whose Cargo workspace is in a subdir (dirt-empire rapid-game: rust/): landGate builds "<affec
