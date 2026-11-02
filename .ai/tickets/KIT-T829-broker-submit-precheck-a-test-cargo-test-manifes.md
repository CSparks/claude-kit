---
id: KIT-T829
title: broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superp
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:41:34Z
updated: 2026-11-02T16:41:34Z
---

## Description
broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superproject 'cargo check -p rg-shader-kit --test X', where the submodule crate's dev-dependencies (rg-testkit, naga_oil) do not exist, so every framework integration test is refused as a compile error before queueing (DE-T245 jobs j-mvzhhkhz-82ybgy, j-mvzhjpn3-7wx2ki). The precheck should check such a command in the manifest's own workspace.

kit-bug-shape: cap:bug:broker-submit-precheck-a-test-cargo-test-manifes
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-02 16:41] (created) bug — broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superp
- [2026-11-02 16:41] (comment) seen again in dirt-empire: broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superproject 'cargo check -p rg-shader-kit --test X', where the submodule crate's dev-dependencies (rg-testkit, naga_oil) do not exist, so every framework integration
- [2026-11-02 16:41] (asked again) 2026-11-02 — cap:bug:broker-submit-precheck-a-test-cargo-test-manifes
