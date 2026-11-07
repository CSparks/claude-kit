---
id: KIT-T860
title: broker land on rapid-game ran an extra 10-crate cargo test sweep (rg-graphics rg-camera rg-editor rg-material-book rg-screens rg-tool-asset-
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T22:37:41Z
updated: 2026-11-05T22:37:41Z
---

## Description
broker land on rapid-game ran an extra 10-crate cargo test sweep (rg-graphics rg-camera rg-editor rg-material-book rg-screens rg-tool-asset-editor rg-outline rg-reflections rg-shader-kit rg-tool-material-editor) beyond the job's own --test lines; it hit the 10 min limit and failed DE-T295 L5d HUD land j-mw443otw-uo2ibl although check j-mw43ytck-gppe1m passed. CLAUDE.md says a land runs exactly the job's own --test list. Log: target/broker/lanes/rapid-game/logs/j-mw443otw-uo2ibl-3.log

kit-bug-shape: cap:bug:broker-land-on-rapid-game-ran-an-extra-10-crate-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A linked landing plans the check, the job's own tests and the conformance test; the submodule workspace's dependents are reported in selection.deferredDependents (landgate-linked.test.mjs 4 passed, 24967af)
- [x] KIT-D137: a progressing build runs past its budget, a stalled build is stopped at the check, the check line names the building crates and contenders (build-checkpoint.test.mjs 7, build-checkpoint-run.test.mjs 6 passed, b265889)
- [ ] OPEN, needs a ruling on KIT-D110 for framework landings: a framework-own landing (rapid-game lane, j-mw443otw-uo2ibl, title case) still runs the dependents of a touched framework crate as a test run; the checkpoint only stops that run being killed while it progresses, so it can pass the KIT-D104 5-minute ceiling

## Plan
1.

## Notes
CAUSE (2026-11-07). The extra command is landgate.mjs dependentTests (KIT-T719, T801/T810, D110 item 1): it reads the Cargo.lock of every workspace a touched crate lives in and adds ONE `cargo test -p <all dependents>` for the workspace. dirt-empire j-mw6o7zh5-p9iibu command 10 was `cd rapid-game/rust && cargo test --offline -p rg-meshkit-bevy -p rg-water ... -p rg-tool-material-editor` (9 framework tools and editors depending on the touched rg-physics); command 8 was the job's own `cd rapid-game/rust && cargo test -p rg-physics --test ...`. The two commands unify features differently, so cargo rebuilt bevy_ecs, bevy_app and 60 more crates cold in the check tree (62 `Compiling` lines in the log) beside a foreign `cargo nextest -p hud -p materials`, and the 600 s flat kill discarded all of it. Evidence: results/j-mw6o7zh5-p9iibu.json, logs/j-mw6o7zh5-p9iibu-9.log in dirt-empire/target/broker.

FIX 1 (24967af): a workspace under a `submodule: true` repo path contributes no dependents command in a consumer landing; its dependents join selection.deferredDependents (the KIT-T853 channel). Safe because linked.mjs pushes the submodule half through its own pre-push gate (cargo check --workspace --all-targets, per the KIT-T874 notes) and the nightly suite runs the framework tests (D110 item 3). The consumer's own dependents (a root-workspace touch) still run, so KIT-T719 stands. Test: landgate-linked.test.mjs 4 (planned list equals [CHECK, own tests, CONFORMANCE]; control: a root touch keeps the root dependents; control: a framework-own landing keeps its dependents run); landgate family 41 passed.

NOT FIXED: this ticket's title case, rapid-game lane job j-mw443otw-uo2ibl, was a framework-own landing (repo rapid-game, cwd inside it): its dependents of a touched rg-probe-kit were 10 framework crates in the same workspace. Dropping those changes D110 for framework landings and is Chris's to rule. FIX 2 keeps such a run from being killed while it progresses. Candidate ruling: compile-check (not test) dependents outside the root workspace.

FIX 2 (b265889, KIT-D137): the flat 10 min kill is a checked budget: build-checkpoint.mjs, build-progress.mjs, build-note.mjs, hooked into run-cancellable.mjs (opts.checkpoint, daemon path only; precheck keeps its flat deadline) and run.mjs. A command is checked every 5 min (or its budget when shorter): log growth or CPU in its process tree since the last check = progressing, continues however long it has run; neither = stalled, stopped at the check. Past its budget (history multiple, floor 10 min) a command that prints nothing and runs no compiler (rustc, linker, cc, build script) is a hung test and is stopped (KIT-T676). A process list that cannot be read never stops a command on CPU alone. The check line (crates compiling, N crates so far, cold or warm against the recorded passing run with the time left, foreign cargo builds from build-contention.mjs, progressing or STALLED) goes to the command log, the daemon stderr and a `<log>.note` file that heartbeat.mjs appends to the `wait.mjs` heartbeat. The log is opened in append mode so broker lines never overwrite the child's output. Tests: build-checkpoint.test.mjs 7, build-checkpoint-run.test.mjs 6 (a progressing build past its budget is not killed, the flat control is killed, a stalled build is stopped, silent CPU inside the budget progresses, a silent spinner past the budget stops as a hung test, the heartbeat carries the line), command-timeout.test.mjs 6 (the daemon's hung job still fails `timed out`).

Not done: no hard ceiling for a build that keeps producing output (D137 asks only for the stalled stop); the bounded foreign-build wait stays off (D105); crates-to-rebuild is not estimated from fingerprints, the estimate is the recorded passing duration of the same command.

## History
- [2026-11-05 22:37] (created) bug — broker land on rapid-game ran an extra 10-crate cargo test sweep (rg-graphics rg-camera rg-editor rg-material-book rg-screens rg-tool-asset-
- [2026-11-07 18:02] (landed) 24967af broker land gate: a linked landing defers the dependents of a touched submodule crate (their test run unified features a
- [2026-11-07 18:17] (landed) b265889 broker: a build over its budget is checked every 5 min, not killed blind: line says what is building and why it is slow,
- [2026-11-07 18:19] (comment) criterion added: A linked landing plans the check, the job's own tests and the conformance test; the submodule workspace's dependents are reported in selection.deferredDependents (landgate-linked.test.mjs 4 passed, 24967af)
- [2026-11-07 18:19] (comment) criterion added: KIT-D137: a progressing build runs past its budget, a stalled build is stopped at the check, the check line names the building crates and contenders (build-checkpoint.test.mjs 7, build-checkpoint-run.test.mjs 6 passed, b265889)
- [2026-11-07 18:19] (comment) ticked: A linked landing plans the check, the job's own tests and the conformance test; the submodule workspace's dependents are reported in selection.deferredDependents (landgate-linked.test.mjs 4 passed, 24967af)
- [2026-11-07 18:19] (comment) ticked: KIT-D137: a progressing build runs past its budget, a stalled build is stopped at the check, the check line names the building crates and contenders (build-checkpoint.test.mjs 7, build-checkpoint-run.test.mjs 6 passed, b265889)
- [2026-11-07 18:24] (comment) criterion added: OPEN, needs a ruling on KIT-D110 for framework landings: a framework-own landing (rapid-game lane, j-mw443otw-uo2ibl, title case) still runs the dependents of a touched framework crate as a test run; the checkpoint only stops that run being killed while it progresses, so it can pass the KIT-D104 5-minute ceiling
