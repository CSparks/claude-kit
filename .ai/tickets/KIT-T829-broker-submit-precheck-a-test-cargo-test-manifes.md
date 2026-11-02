---
id: KIT-T829
title: broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superp
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:41:34Z
updated: 2026-11-02T17:06:15Z
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

## Notes
Fix: scripts/broker/precheck-scope.mjs narrowChecks groups the job's cargo commands by workspace; a --manifest-path command (also --manifest-path=) gets its own cargo check that repeats the manifest and drops the superproject --features, so the framework crate resolves with its own dev-dependencies (rg-testkit, naga_oil); the repo-level check still follows. precheck.mjs runs every stage. Tests: precheck-scope 6 (2 new), precheck-manifest 2 new (stage commands + negative control), precheck-submodule 4, precheck 6, guards, missing-log: 37 passed; mutation (manifest ignored) fails 4. Duplicates: q fts finds only this ticket; the second cap filing was folded in by cap (asked: 2), nothing else to close. Same gap for a non-submodule 'cd <dir> &&' prefix is left as is (precheck-submodule control locks it).

## History
- [2026-11-02 16:41] (created) bug — broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superp
- [2026-11-02 16:41] (comment) seen again in dirt-empire: broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superproject 'cargo check -p rg-shader-kit --test X', where the submodule crate's dev-dependencies (rg-testkit, naga_oil) do not exist, so every framework integration
- [2026-11-02 16:41] (asked again) 2026-11-02 — cap:bug:broker-submit-precheck-a-test-cargo-test-manifes
- [2026-11-02 17:06] (landed) d70d595 Broker precheck: a --manifest-path cargo test is checked in its own workspace with its dev-dependencies, not folded into
- [2026-11-02 17:06] (status) todo → review
- [2026-11-02 17:11] (landed) 00e36d4 KIT-T829 to review [no-test: ticket store only] (implements KIT-T829)
- [2026-11-02 17:15] (landed) 5619d74 KIT-T829 ticket sync [no-test: ticket store only] (implements KIT-T829)
