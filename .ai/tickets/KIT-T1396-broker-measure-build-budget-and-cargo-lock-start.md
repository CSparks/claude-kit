---
id: KIT-T1396
title: broker: measure build-budget and cargo-lock start delays, and let a read-only cargo check of a disjoint package closure run without waiting behind a long build (proposal)
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T20:45:30Z
updated: 2026-11-18T20:45:30Z
---

## Description
Agents in road-generator report broker `cargo check` calls that waited 170 to 400 s before starting while several writers share one checkout and one target directory. Proposal only (KIT-T1392 follow-up); nothing built.

Numbers, road-generator `target/broker/runs/*.json` for 2026-11-18 (197 cargo runs through `builds --run`):
- cargo check: 54 ended, median 80 s, 10 over 170 s, 1 over 400 s; 14 of 56 check runs printed a build-budget "queued for N cores" line; 1 printed cargo's "Blocking waiting for file lock".
- cargo test: 35 ended, median 172 s, 18 over 170 s, 5 over 400 s. cargo build: 103 ended, median 72 s, 4 over 170 s, 2 over 400 s.
- Up to 5 cargo runs were in flight at once.
- A run record carries no queue or lock wait time, so the start delay itself is not measured; the build-budget queue (cores) shows up far more often than cargo's own target-dir lock.

Proposal:
1. Measure first: record on each run and build hold the queue wait (build-budget) and the cargo lock wait (time to the first "Compiling"/"Checking" line after a "Blocking waiting for file lock"), printed in `builds --result` and summarised by `builds`.
2. A read-only `cargo check -p X` whose package closure is disjoint from every running build's scope may run with its own target directory (`CARGO_TARGET_DIR=target/check-<lane>`), so it never waits on another build's target lock; checks share one such dir in order, never one per call (disk and cold-build cost).
3. Ordering rule while one target dir stays shared: a check queued behind a long `cargo test` of a disjoint closure starts before it in the budget queue (checks are short: median 80 s against 172 s for tests).
Risks to weigh: a second target dir costs a cold build of the shared dependencies (minutes, several GB) once; check output is then not reused by the next build in the main dir.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T729, KIT-T1272, KIT-T1046, KIT-T680

## History
- [2026-11-18 20:45] (created) feature — broker: measure build-budget and cargo-lock start delays, and let a read-only cargo check of a disjoint package closure run without waiting behind a long build (proposal)
