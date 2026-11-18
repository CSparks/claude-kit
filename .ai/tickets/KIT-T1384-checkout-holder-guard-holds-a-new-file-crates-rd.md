---
id: KIT-T1384
title: checkout-holder guard holds a NEW file crates/rdg-world/tests/yard_ground.rs while another writer's build is 'cargo test -p rdg-world --test
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T18:48:39Z
updated: 2026-11-18T19:20:09Z
fixed_commit: 72919265
---

## Description
checkout-holder guard holds a NEW file crates/rdg-world/tests/yard_ground.rs while another writer's build is 'cargo test -p rdg-world --test road_ends_served --no-run': that build compiles only its own test target (tests/road_ends_served.rs + lib), never a new tests/*.rs; the guard should scope test-target builds to the named --test file and the lib's src, so writers can add test files during a long test build

kit-bug-shape: cap:bug:checkout-holder-guard-holds-a-new-file-crates-rd:264684a8
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a build that selects targets (--test x, --lib) holds only the tests/ files its targets read: a new tests/ file beside it passes, the selected target, its modules and src stay held, any doubt keeps the hold (scripts/broker/cargo-targets.test.mjs)

## Plan
1.

## Notes
Root cause: the build hold recorded the packages a cargo call compiles (scope, KIT-T1147) but not the targets it selects. hooks/lib/build-write-hold.mjs passes a .rs file no module chain reaches, yet a new tests/yard_ground.rs is a target root Cargo discovers, so it counted as compiled by every build of rdg-world, `cargo test -p rdg-world --test road_ends_served --no-run` included, which reads only the lib and that one test target.

Fix: scripts/broker/cargo-targets.mjs. targetSelection(args) reads --test/--lib/--bin/--example/--bench (null when nothing is selected, or for --tests, --all-targets, --benches and the like); build-run.mjs records it on the hold as `targets`. The guard passes a write to a file under a package's tests/ directory that no selected test target can read: not tests/<name>.rs or tests/<name>/ of a selected name, and no selected root names it with `mod`, `#[path]` or `include!`. A [[test]] table in the manifest, a selected target with no root file, or no Cargo.toml keeps the write held. src/ files stay held (the lib is built for a --test build). A hold recorded before this change has no `targets` and keeps holding.

Tests: scripts/broker/cargo-targets.test.mjs 4 pass (the selection; the new test file unread while the selected target, its `mod common` module and src stay held; each doubt keeps it held; buildHoldConflict passes yard_ground.rs and still refuses road_ends_served.rs, and an older hold without targets keeps holding); build-write-hold, build-run, build-scope, build-slot, cargo-scope-dirs pass.

## History
- [2026-11-18 18:48] (created) bug — checkout-holder guard holds a NEW file crates/rdg-world/tests/yard_ground.rs while another writer's build is 'cargo test -p rdg-world --test
- [2026-11-18 19:19] (status) todo → doing
- [2026-11-18 19:19] (comment) criterion added: a build that selects targets (--test x, --lib) holds only the tests/ files its targets read: a new tests/ file beside it passes, the selected target, its modules and src stay held, any doubt keeps the hold (scripts/broker/cargo-targets.test.mjs)
- [2026-11-18 19:19] (comment) ticked: a build that selects targets (--test x, --lib) holds only the tests/ files its targets read: a new tests/ file beside it passes, the selected target, its modules and src stay held, any doubt keeps the hold (scripts/broker/cargo-targets.test.mjs)
- [2026-11-18 19:19] (landed) 72919265 build hold: a build that selects its targets (--test x, --lib) no longer holds a tests/ file none of them reads; the sel
- [2026-11-18 19:20] (status) doing → review
- [2026-11-18 19:20] (comment) runtime 72919265 published
