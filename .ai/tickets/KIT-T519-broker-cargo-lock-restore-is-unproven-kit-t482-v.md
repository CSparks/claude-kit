---
id: KIT-T519
title: Broker Cargo.lock restore is unproven: KIT-T482 vetting saw 'dirt-from-own-run: rust/Cargo.lock changed by job j-mv8ly4le' (2026-10-14); BROKER.md now says every Cargo.lock is journalled, but no test shows a check-only run that rewrites Cargo.lock (and a killed mid-run one) leaves it byte-identical
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T17:28:30Z
updated: 2026-10-16T14:58:56Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T493, KIT-T496
### comment #1 [2026-10-15 17:28] @claude
Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from zero (KIT-T518), Cargo.lock restore unproven (KIT-T519), a stale queued --pin moving a gitlink backwards (KIT-T515)).
### comment #2 [2026-10-15 19:14] @claude
Done in 06483c6 (pushed). Root cause found by the new test: lockFiles() is git ls-files of the superproject, which stops at a gitlink, so rapid-game/rust/Cargo.lock was never journalled or removed. locks.mjs lockFilesDeep now includes every checked-out submodule's locks; patch, train and guardLocks/dropNewLocks use it. Tests: lock-restore.test.mjs 7 passed (root lock, nested lock plus created lock removed, real cargo check after a version bump, daemon SIGKILLed after the rewrite then recoverInflight and rerun, submodule lock rewritten, submodule lock created, killed daemon with a submodule lock); the two submodule cases failed before the fix. Broker suite 272 of 274, the 2 stop tests are load-timing flakes that pass alone.
### comment #3 [2026-10-16 14:58] @claude
Vetting 2026-10-16 (broker-vetting findings): fix 06483c6 restores the lock after a job but does not cover the gate-run -> push window. Seen twice: j-mva9e3pz (runtime 1a92179): the broker's own pre-push gate run rewrote rapid-game rust/Cargo.lock, then the git hook refused 'uncommitted changes under rust: rust/Cargo.lock'. Live 2026-10-16 14:41Z j-mvb2gdpy: committed bccca462 lacked the 2-line lock edit its diffStat carried (rg-synth-bevy deps audioadapter-buffers, rg-testkit); the gate's cargo rewrote it. Reopening for the fix; test: after the broker's own pre-push gate run the tree Cargo.lock matches HEAD or the gate-written lock is folded into the commit before push.

## History
- [2026-10-15 17:28] (created) bug — Broker Cargo.lock restore is unproven: KIT-T482 vetting saw 'dirt-from-own-run: rust/Cargo.lock changed by job j-mv8ly4le' (2026-10-14); BROKER.md now says every Cargo.lock is journalled, but no test shows a check-only run that rewrites Cargo.lock (and a killed mid-run one) leaves it byte-identical
- [2026-10-15 17:28] (comment) @claude: Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from ze (full comment #1 in ## Notes)
- [2026-10-15 19:14] (comment) @claude: Done in 06483c6 (pushed). Root cause found by the new test: lockFiles() is git ls-files of the superproject, which stops (full comment #2 in ## Notes)
- [2026-10-15 19:14] (status) todo → review
- [2026-10-16 14:58] (comment) @claude: Vetting 2026-10-16 (broker-vetting findings): fix 06483c6 restores the lock after a job but does not cover the gate-run  (full comment #3 in ## Notes)
- [2026-10-16 14:58] (status) review → todo
