---
id: KIT-T695
title: broker: both lanes share one CARGO_TARGET_DIR but the submodule lane's commands use rapid-game's cargo aliases (cargo t/b/r add --features r
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T02:12:47Z
updated: 2026-10-29T02:12:47Z
---

## Description
broker: both lanes share one CARGO_TARGET_DIR but the submodule lane's commands use rapid-game's cargo aliases (cargo t/b/r add --features rg-engine/dynamic_linking) while root-lane game builds do not; dirt-empire 2026-10-29 target/debug held 12 libbevy_ecs rlibs and root links failed in rust-lld with undefined generic symbols (indexmap Entry::or_insert_with, bevy_ecs ComponentHooks::update_from_component) even after cargo clean -p dirt-empire. Fix: per-lane target dir, or one feature set across lanes (rapid-game's own config warns against mixing).

kit-bug-shape: cap:bug:broker-both-lanes-share-one-cargo-target-dir-but
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 02:12] (created) bug — broker: both lanes share one CARGO_TARGET_DIR but the submodule lane's commands use rapid-game's cargo aliases (cargo t/b/r add --features r
