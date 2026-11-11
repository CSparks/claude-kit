---
id: KIT-T853
title: Broker land gate ran the whole cargo test -p dirt-empire -p look -p track instead of only the job's own --test list and hit the 10-minute li
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T719]
files: []
supersedes:
superseded_by:
created: 2026-11-03T16:44:56Z
updated: 2026-11-03T16:51:19Z
---

## Description
Broker land gate ran the whole cargo test -p dirt-empire -p look -p track instead of only the job's own --test list and hit the 10-minute limit (dirt-empire DE-T299 job j-mw072zh5-rlndox; own tests passed). Project rule: a land runs exactly the job's own --test list. Blocks every dirt-empire land incl. DE-T287; KIT-D104: gate must stay under 5 minutes.

kit-bug-shape: cap:bug:broker-land-gate-ran-the-whole-cargo-test-p-dirt
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a land gate no longer adds a dependent that the project suite runs whole (dirt-empire: cargo test -p dirt-empire) to a landing; it is reported as selection.deferredDependents; landgate-dependents 5 and 36 other landgate/affected/pin-scope/train-commands tests passed

## Plan
1.

## Notes
Cause: KIT-T719/T801 (D110 item 1) add the Cargo.lock dependents of a touched crate to the land gate even when the job names its own --test list. For dirt-empire a touched leaf crate makes 'dirt-empire' a dependent, so the gate ran cargo test -p dirt-empire (the project's whole suite) and hit the 10-minute command limit (j-mw072zh5-rlndox). Fix: a dependent that the project's broker suite runs whole (an unfiltered cargo test -p X in broker.suite) is the suite, so it runs on the nightly slot (D110 item 3) and not in a landing (D104); other dependents still run. Other dependents (look, track) and the job's own list are unchanged. Not changed: affected.dependents: false would also stop all dependents; I did not turn that on. Verified against dirt-empire config: touching crates/race now gives check + the job's own commands + conformance, deferredDependents [dirt-empire].

## History
- [2026-11-03 16:44] (created) bug — Broker land gate ran the whole cargo test -p dirt-empire -p look -p track instead of only the job's own --test list and hit the 10-minute li
- [2026-11-03 16:45] (status) todo → doing
- [2026-11-03 16:51] (comment) criterion added: a land gate no longer adds a dependent that the project suite runs whole (dirt-empire: cargo test -p dirt-empire) to a landing; it is reported as selection.deferredDependents; landgate-dependents 5 and 36 other landgate/affected/pin-scope/train-commands tests passed
- [2026-11-03 16:51] (comment) ticked: a land gate no longer adds a dependent that the project suite runs whole (dirt-empire: cargo test -p dirt-empire) to a landing; it is reported as selection.deferredDependents; landgate-dependents 5 and 36 other landgate/affected/pin-scope/train-commands tests passed
- [2026-11-03 16:51] (status) doing → review
- [2026-11-03 16:51] (landed) 2a335ca broker land gate: a dependent crate the project suite runs whole (cargo test -p dirt-empire) is left to the nightly suit
