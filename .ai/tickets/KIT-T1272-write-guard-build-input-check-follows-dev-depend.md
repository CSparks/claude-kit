---
id: KIT-T1272
title: write-guard build-input check follows dev-dependency edges: a cargo build of road-generator (test one_road_system) is said to compile rg-pla
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T18:22:50Z
updated: 2026-11-15T19:16:32Z
---

## Description
write-guard build-input check follows dev-dependency edges: a cargo build of road-generator (test one_road_system) is said to compile rg-plan-map through rdg-world, but rg-plan-map is only a dev-dependency of rdg-world, which cargo does not build for a dependent crate's tests. It refused an edit to rapid-game/rust/world/rg-plan-map/src/table.rs (KIT-T1114) that no running build reads.

kit-bug-shape: cap:bug:write-guard-build-input-check-follows-dev-depend:ac7670ee
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in fee78e8 (runtime fee78e8). cargo-scope-dirs.mjs closure() applied the buildsTests switch to the whole dependency closure, so a test, bench or example build of the selected package followed the dev-dependency edges of EVERY crate it reached; cargo only compiles the dev-dependencies of the built (selected) package, never of a dependency. Now a dev-dependency edge is followed only out of a built package and only when a test, bench or example is built. Test both ways in scripts/broker/cargo-scope-dirs.test.mjs: build, run, check, test, test --no-run, check --tests, build --examples, bench of the built package never hold the dev-dependency of its dependency; build and plain check do not hold the package own dev-dependency; test, check --tests, bench and build --examples do; testing the declaring package itself holds its dev-dependency (the test failed on the old code for test -p). cargo-scope-dirs 13, scope-invariants 8, build-scope 10, precheck-scope 6, pin-scope 9 passed, build-write-hold all PASS.

## History
- [2026-11-15 18:22] (created) bug — write-guard build-input check follows dev-dependency edges: a cargo build of road-generator (test one_road_system) is said to compile rg-pla
- [2026-11-15 19:16] (landed) fee78e8 The git config read side is an exact allowlist of raw tokens; a build's scope follows dev-dependencies only out of a bui
- [2026-11-15 19:16] (status) todo → review
