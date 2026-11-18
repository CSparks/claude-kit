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
Proposal extended 2026-11-18 (coordinator's brief, after KIT-T1404): keep writers moving while long builds run. Not built.

Numbers, road-generator target/broker/runs for 2026-11-18 (cargo check/test/build through builds --run): 238 runs, 568 cargo-run minutes; 22 runs over 300 s and 9 over 600 s (longest: test road-generator 1233 s, test rdg-world 1200 s, test rg-townplan 1147 s, test rdg-world 1121 s, test rg-townplan 944 s, build road-generator 919 s); peak 7 runs at once; 58 minutes with 3 or more runs in flight and 16 minutes with 5 or more. In that span the buildings writer could not land one edit for about 25 minutes: the write guard refuses any edit to a crate a running build compiles (a 14-minute rg-townplan-bevy test compiles rg-buildings and rg-shader-kit), and with overlapping builds a crate is almost never free.

Design options, in the order I would build them:
1. Release a crate as soon as the running build has compiled it. A build's hold names the crates it compiles; cargo reports each unit as it finishes (`--message-format json`: a `compiler-artifact` message per crate, then the test binaries run). The build shim reads its own cargo's stream and drops a crate from the hold's scope when its artifact message arrives (the `phase: running` switch that already frees the whole hold when tests start, done per crate). A writer then waits only while its crate is still being compiled; a dependency crate such as rg-buildings is compiled in the first minute or two of a 14-minute test run and is free for the remaining twelve. Cost: the shim must parse cargo's JSON stream (it already forwards stderr and watches for the test phase); a build whose output format the shim cannot set keeps today's whole-run hold.
2. A writer's reservation queues new builds: a writer refused by a hold may reserve the crate for up to N seconds (say 120, the IN_FLIGHT_S of KIT-T1404); builds that would start on that crate wait behind the reservation (START_WAIT_S already does this for one window), and the writer lands its batch the moment the current build releases the crate (option 1) or ends. Bound: a reservation never delays a build start more than N seconds and a writer cannot renew it back to back while another writer waits.
3. Measure first (from the original proposal): record the time each writer spent refused by a hold and each build spent queued, so the gain of 1 and 2 shows in numbers.
Risk to weigh for 1: a crate released mid-build can be edited while the same build later links a binary against the old artifact; that build's result then describes code that changed under it. The hold's test phase already accepts this for test runs; for a `cargo build` the release should wait until the build's own binary crates are done.

## History
- [2026-11-18 20:45] (created) feature — broker: measure build-budget and cargo-lock start delays, and let a read-only cargo check of a disjoint package closure run without waiting behind a long build (proposal)
