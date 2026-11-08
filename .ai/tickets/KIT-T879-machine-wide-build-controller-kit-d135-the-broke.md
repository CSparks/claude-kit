---
id: KIT-T879
title: Machine-wide build controller (KIT-D135): the broker gates concurrent builds across ALL workspaces, not only writers inside one repo. 2026-1
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T17:17:11Z
updated: 2026-11-07T18:13:35Z
---

## Description
Machine-wide build controller (KIT-D135): the broker gates concurrent builds across ALL workspaces, not only writers inside one repo. 2026-11-07 freeze between load screen and gameplay with concurrent pixelvision cargo-ndk release + dirt-empire cargo test -j 15 + stiletto cargo t (jobs=24), 16/64 GB RAM free. Wants a global job-slot budget (CPU + commit-limit memory), queue/throttle instead of simultaneous -j 15/24, priority for a running game or UAT session, and a who-is-building readout.

kit-bug-shape: cap:feature:machine-wide-build-controller-kit-d135-the-broke
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Budget: physical cores (OS) minus reserve >= 2 shared by all Rust builds
- [x] Direct cargo, nextest, ndk builds in Bash/PowerShell take cores through the build-wrap hook and bin/build-shims
- [x] Broker commands, pre-push gate and shim builds share one core pool; builds queue instead of running -j 24 together
- [x] A running game cuts the budget and lowers build priority
- [x] builds prints who holds cores and who waits
- [x] Project settings over the budget are reported, never edited

## Plan
1.

## Notes
Landed 051a7c7. Machine build budget (KIT-D135): budget = OS physical cores minus reserve (>=2, config can raise): 16 physical -> 14; a running game takes gameCores (6) off -> 8. Measured (scripts/broker/build-budget.test.mjs, 10 processes x 2 cores): peak 14 cores held machine-wide, 2 free. Mutation MIN_RESERVE_CORES=2->0: peak 16, 0 free, tests fail; reverted. Tests: build-budget 4, build-grant 5, build-slot 11, build-run 7, build-status 3, jobs 2, scope-invariants, testkit-slots, hooks/build-wrap 6 passed. Entry points: bin/build-shims (cargo, cargo-nextest, cargo-ndk) put on PATH by hooks/build-wrap.mjs (row-tag for background); broker run.mjs/run-cancellable.mjs/prepush.mjs share the same pool. Readout: bin/builds [--audit]. Settings over budget (read only, clamped when they run): stiletto-2349 .cargo/config.toml jobs=24. dirt-empire config is jobs=12 (within); its -j 15 was broker jobs:auto, which used logical cores; auto is now capped at 14. pixelvision runs cargo ndk with no -j (cargo default = 32 logical); the shim cuts it to the budget. Gaps: cargo run outside a Claude shell call (plain terminal, rust-analyzer flycheck) and Codex are not gated; hooks.json entry needs a plugin reload; the stale old-format slot-0 file counts as a full-budget hold until its pid dies; old-runtime brokers ignore slot-<ticket> files until they restart on the new runtime. Pre-existing flake: build-contention-run.test.mjs depends on an unrelated foreign cargo build being visible (fails when none runs, passes at HEAD when one does). [test: scripts/broker/build-budget.test.mjs]
Activation: plugin 0.1.33 (08a8308), runtime 08a8308 published, hooks.json carries build-wrap, bin/build-shims in runtime. Verified from the published runtime: hook output prefixes PATH with runtime/08a8308/bin/build-shims; cargo resolves to the shim; cargo --version passes through (info only, never holds cores); a cargo check -j 24 printed 'asked for 24 cores, running on 14' and compiled; with a dirt-empire cargo test holding 14 cores (36 min, via the live hook) the readout showed that holder and my check waiting. Installed plugin cache still 0.1.32 until sessions restart. [no-test: activation of tested code]

## History
- [2026-11-07 17:17] (created) feature — Machine-wide build controller (KIT-D135): the broker gates concurrent builds across ALL workspaces, not only writers inside one repo. 2026-1
- [2026-11-07 17:17] (comment) @claude: Chris 2026-11-07: 'There should always be at least 2 cores (this is a 16 core machine, not 32) not utilized for building (full comment #1 in ## Notes)
### comment #1 [2026-11-07 17:17] @claude
Chris 2026-11-07: 'There should always be at least 2 cores (this is a 16 core machine, not 32) not utilized for building.' Budget is at most 14 cores machine-wide. Current settings exceed it: stiletto .cargo/config.toml jobs=24, dirt-empire cargo test -j 15 (seen running).
- [2026-11-07 17:22] (comment) @claude: Chris 2026-11-07: 'ANd that needs to be across ALL projects. Rust or C++' then 'Though GrooveGrid builds really don't ch (full comment #2 in ## Notes)
### comment #2 [2026-11-07 17:22] @claude
Chris 2026-11-07: 'ANd that needs to be across ALL projects. Rust or C++' then 'Though GrooveGrid builds really don't chew as much CPU as Rust, so just rust for now.' and 'We'll revisit if it is still a problem.' Scope: ALL projects, Rust builds only (cargo, rustc, nextest, cargo-ndk); C++ out for now.
- [2026-11-07 17:57] (landed) 051a7c7 broker: machine-wide Rust build budget across every project: physical cores minus 2 reserve, queue and clamp -j, game yi
- [2026-11-07 17:58] (comment) criterion added: Budget: physical cores (OS) minus reserve >= 2 shared by all Rust builds
- [2026-11-07 17:58] (comment) criterion added: Direct cargo, nextest, ndk builds in Bash/PowerShell take cores through the build-wrap hook and bin/build-shims
- [2026-11-07 17:58] (comment) criterion added: Broker commands, pre-push gate and shim builds share one core pool; builds queue instead of running -j 24 together
- [2026-11-07 17:58] (comment) criterion added: A running game cuts the budget and lowers build priority
- [2026-11-07 17:59] (comment) criterion added: builds prints who holds cores and who waits
- [2026-11-07 17:59] (comment) criterion added: Project settings over the budget are reported, never edited
- [2026-11-07 17:59] (comment) ticked: Budget: physical cores (OS) minus reserve >= 2 shared by all Rust builds
- [2026-11-07 17:59] (comment) ticked: Direct cargo, nextest, ndk builds in Bash/PowerShell take cores through the build-wrap hook and bin/build-shims
- [2026-11-07 17:59] (comment) ticked: Broker commands, pre-push gate and shim builds share one core pool; builds queue instead of running -j 24 together
- [2026-11-07 17:59] (comment) ticked: A running game cuts the budget and lowers build priority
- [2026-11-07 17:59] (comment) ticked: builds prints who holds cores and who waits
- [2026-11-07 17:59] (comment) ticked: Project settings over the budget are reported, never edited
- [2026-11-07 18:05] (landed) 9826963 tickets: KIT-T879 acceptance ticked, measured numbers and gaps in Notes [no-test: ticket store only] (implements KIT-T87
- [2026-11-07 18:13] (status) todo → review
- [2026-11-07 18:13] (landed) 3e0ff80 tickets: KIT-T879 to review, runtime 9826963 published [no-test: ticket store only] (implements KIT-T879)
- [2026-11-08 17:18] (landed) 08a8308 plugin 0.1.33: sessions pick up the build-wrap hook registration (implements KIT-T879)
