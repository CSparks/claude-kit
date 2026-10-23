---
id: KIT-D106
title: Cargo build dirs are swept nightly and automatically, age-based by generation (supersedes KIT-T273 "deliberately not automated")
summary: The maintainer approved an automatic 03:30 sweep of every cargo build dir under the dev root at any depth. It keeps the newest generation of every crate, removes older generations and orphaned incremental sessions, and deletes whole non-primary build dirs idle 14+ days. KIT-T273's "report, never delete" no longer holds.
date: 2026-10-23
supersedes: 
source: 
---


**Decision:** Chris 2026-10-23 approved a NIGHTLY, AUTOMATIC, age-based sweep of cargo build dirs (scripts/build-sweep.mjs, Windows Task Scheduler / launchd at 03:30). Per profile dir it keeps the newest generation of each crate in deps/, .fingerprint/, build/ and incremental/ (plus siblings built within an hour of it) and removes older generations; a non-primary build dir idle 14+ days goes whole. A repo with cargo/rustc running against it or a live broker lock is skipped. SessionStart surfaces the last receipt and warns when the task is missing or not firing. This supersedes KIT-T273's "DELIBERATELY NOT AUTOMATED: the hook reports and hands over the command, it does not delete".

**Why:** 2026-10-23 a single build dir reached ~1 TB (stiletto rapid-game/rust/target: 57,756 deps entries, 3,564 incremental sessions) and the build dirs at all depths (target-*, lanes, worktrees, submodules) went unwatched, because the report-only nag saw one repo's top-level target. The newest generation is never removed, so the cost of a sweep is bounded to rebuilding variants the next build still needs, not a cold rebuild.

**Rejected:** a report-only nag (it demonstrably did not reclaim the disk); a 7-day per-artifact age rule (a dependency compiled long ago and untouched since is still live); cargo clean (cold rebuild of the live generation).
