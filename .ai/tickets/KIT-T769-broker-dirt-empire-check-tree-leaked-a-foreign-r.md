---
id: KIT-T769
title: broker: dirt-empire check tree leaked a foreign rapid-game patch into an unrelated job. j-mvwllvig-oap0hj (DE-T228, touches only crates/bike
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T770
superseded_by:
created: 2026-10-31T16:28:57Z
updated: 2026-11-01T15:55:09Z
---

## Description
broker: dirt-empire check tree leaked a foreign rapid-game patch into an unrelated job. j-mvwllvig-oap0hj (DE-T228, touches only crates/bike crash/lift + dirt-empire art/tests) failed E0063 in crates/bike/src/voice.rs and crates/truck/src/voice.rs (EngineSpec missing burble/high_tame, LowWeight missing from_hz/full_hz). Those fields exist in no commit anywhere (git log --all -S high_tame empty); target/broker/check/dirt-empire/rapid-game at e5412d93 shows uncommitted edits to rust/audio/rg-synth/src/engine/{body,combustion,mod,presets,spec}.rs and tests/low_weight.rs, another job's rg-synth patch left in the submodule of the superproject check tree. Root cause to find: the check tree restore does not reset the rapid-game submodule worktree between jobs (or a linked rapid-game patch is applied without its game half).

kit-bug-shape: cap:bug:broker-dirt-empire-check-tree-leaked-a-foreign-r
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause confirmed: (b), not (a). Timeline from dirt-empire results/finished.log and the worktree reflogs: j-mvwllsyo-s23z2a (DE-T264) ran 11:12:45-11:16:05 CDT and j-mvwllvig-oap0hj (DE-T228) 11:22:28-11:25:19; each tree was reset to a clean pin at job start (reflog: check/dirt-empire/rapid-game moved to 68b4d95 at 11:12:45 and to e5412d93 at 11:22:27, checkout -f plus clean). DE-T263's gated run (j-mvwlly01) did not run a command until 11:25:28, after both jobs failed, so the rg-synth edits seen in the check tree at 11:28 (KIT-T769's observation) were its own gated run, not a leak into j-mvwllvig. j-mvwllsyo ran with no DE-T263 patch in any check tree and still got E0063 from the new spec, and the j-mvwllvig log recompiles truck and bike but not rg-synth: an rg-synth artifact built from other source in the shared target/debug was judged fresh by mtime. Check, live and lane trees of one repo overwrite each other's artifacts in place (hash relative to the workspace root, KIT-D115 shares them on purpose); a tree whose file is older than that artifact skips the rebuild. Hypothesis (a) refuted: prepareCheckTree resets with checkout -f + clean for the repo and its submodule worktrees before every job, each lane is one daemon (broker.lock) running jobs serially, and each (kind, repo) has its own tree directory.
Fix: scripts/broker/content-align.mjs keeps a ledger per target dir and workspace (each repo's HEAD plus the files differing from it at the last build) and gives every file whose content differs from the last build a fresh mtime before a build; scripts/broker/build-guard.mjs takes a per-target-dir mutex around that and the build (run.mjs, run-cancellable.mjs, prepush.mjs after the build slot). Cost measured on dirt-empire: 0.23 s tree state, 0.3 s align on the check tree, 0.45 s on the live tree, per cargo command; no extra target dir, no cold build. Files whose content equals the last build keep their mtime, so an unchanged crate is not rebuilt. The first build after install has no ledger and aligns nothing, so an artifact already poisoned stays until its crate next changes.
Tests: scripts/broker/content-align.test.mjs 5 passed (real cargo: control links the foreign build, aligned tree rebuilds; submodule edit then unrelated job reads the clean submodule), build-guard.test.mjs 4 passed; check-tree, land, linked, patch, mtime-align, build-slot, link-recover, stall suites 83 passed.

## History
- [2026-10-31 16:28] (created) bug — broker: dirt-empire check tree leaked a foreign rapid-game patch into an unrelated job. j-mvwllvig-oap0hj (DE-T228, touches only crates/bike
- [2026-11-01 15:55] (landed) 99d4cc5 broker: a cargo build gives every file whose content differs from the target dir's last build a fresh mtime, under a per
- [2026-11-01 15:55] (status) todo → review
