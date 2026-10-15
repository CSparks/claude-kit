---
id: KIT-T483
title: Single-writer speed: nextest coalescing of a job's cargo tests, suite-due priority over a busy queue, patch-worker pings and wait heartbeat (Chris 2026-10-14: the one writer slot is too slow)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T18:36:02Z
updated: 2026-10-14T18:42:47Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] runner: nextest runs a job's per-target cargo tests as one nextest invocation; filters, unfiltered runs, other packages and lone targets keep their own run (coalesce.test.mjs)
- [x] Once suite_every landings accumulate, the suite runs before the next queued job and is not cancelled; below the threshold the queue is never held (suite-due.test.mjs)
- [x] wait.mjs prints a heartbeat (queue position or running time and command) every --heartbeat s; patch-worker has SendMessage and pings one line per landed job (heartbeat.test.mjs)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T472
### comment #1 [2026-10-14 18:42] @claude
Measured on 195 dirt-empire jobs (46,257 s): game-crate compile 45-50 s per src change plus 27 s cfg(test) lib when --lib runs; each extra --test about 5 s compile+link; execution is 6,672 of 10,860 s in multi-target jobs, run serially. Coalescing estimate on the 42 multi-target jobs: build 3,758 -> about 2,118 s, run 6,619 -> about 2,885 s. Suite never ran on dirt-empire: idle-only and cancelled by any queued job. Evidence: node --test scripts/broker/*.test.mjs = 151 passed; the forced-suite mutation fails suite-due.
### comment #2 [2026-10-15 01:13] @claude
Incremental flip re-measure (dirt-empire 2f4ea20, 2026-10-14 19:50Z; read-only from target/broker/results). Still only 15 jobs after the flip (no new jobs since), so not yet the ~20 asked for. Overall median first command 57.5 s before (195 builds) vs 76.5 s after (13). Like for like: single dirt-empire test target ('cargo t -p dirt-empire --test X') 38 s median over 203 runs before vs 95 s over 2 after; 'cargo check --offline --workspace --all-targets' 43 s (n=7) vs 81 s (n=3). Confounders in the after window: the first rebuild under the new profile (check 113 s + test 131 s at 19:53), a new job kind sharing the target dir (5 rapid-game workspace runs, --manifest-path rust/Cargo.toml, median 324 s), and one 1005 s wide selection. target/debug/incremental holds 411 session dirs (dirt_empire 14, rg_input 9, rg_engine/rg_screens/rg_testkit 8 each): rg crates are built incrementally by BOTH workspaces into the one target. Not separable at n=2-3; the 2.5x like-for-like gap is a real warning sign, not proof. A controlled A/B needs builds in the dirt-empire checkout, which is that session's call: same warm tree, same command, CARGO_INCREMENTAL=0 vs 1, three runs each.
### comment #3 [2026-10-15 01:22] @claude
A/B (coordinator, dirt-empire, broker idle, 2026-10-14): touch crates/dirt-empire/src/lib.rs then 'cargo test --offline -p dirt-empire --test door_hygiene', alternating CARGO_INCREMENTAL. Raw: inc=1 221 s, inc=0 126 s, inc=1 16 s, inc=0 43 s, inc=1 15 s, inc=0 43 s. The first pair are rebuilds after the flip; steady state incremental ~15 s vs ~43 s without (touch only; a real edit costs more). Ruling: keep incremental. The post-flip slowdown in #2 was most likely the first rebuild plus the rapid-game workspace builds sharing the target dir with different settings (follow-ups: measure that thrash; bound incremental cache growth).
### comment #4 [2026-10-15 01:36] @claude
Follow-ups. (1) Shared-target thrash: measured from dirt-empire logs (read-only), first command of each job by the job before it: a game job after a game job compiled a median of 1 crate (58 s, n=197); after a rapid-game job, 16 crates (15 rg, 95 s, n=5; one 280 s). But every one of those rapid-game jobs patched rust/engine/rg-input (gamepad/mod.rs, gamepad/plugin.rs, ui/action.rs) and the broker restored those files after the check run: the restore bumps their mtimes, cargo's path-dependency freshness is mtime-based, so rg-input and its 15 dependents rebuild in the game workspace. A rapid-game job before a game job with nothing to rebuild compiled 0. That is mtime churn from patching a shared crate, not two workspaces overwriting each other: real cargo 1.95 with two workspaces sharing a crate under different features, profiles and rustflags in one target dir recompiled 0 crates over three alternations. A per-workspace target dir would not remove the churn (the game target still sees newer sources), so it was not built; restoring old mtimes would make cargo reuse artifacts built from the patched bytes, which is wrong. Trains cut it: one patch+restore per batch. (2) Incremental growth: built incremental.mjs + the after-suite prune (keep each crate's newest plus anything used within incremental_keep_hours, default 24; drop stale -working sessions). dirt-empire now (dry run, read-only): 12.34 GB in 412 dirs over 118 crates; keep 24 h or 6 h -> 0 removed (every dir is from today's flip); keep 0 (newest per crate only) -> 2.14 GB (294 removed). Newest-only was not made the default: the gate alternates check and test units of the same crate, which would lose their caches every job. incremental.test.mjs 3 passed (daemon prunes after a suite run; negative control incremental_keep_hours: off). npm test exit 0, broker 220 passed.

## History
- [2026-10-14 18:36] (created) feature — Single-writer speed: nextest coalescing of a job's cargo tests, suite-due priority over a busy queue, patch-worker pings and wait heartbeat (Chris 2026-10-14: the one writer slot is too slow)
- [2026-10-14 18:42] (comment) criterion added: runner: nextest runs a job's per-target cargo tests as one nextest invocation; filters, unfiltered runs, other packages and lone targets keep their own run (coalesce.test.mjs)
- [2026-10-14 18:42] (comment) criterion added: Once suite_every landings accumulate, the suite runs before the next queued job and is not cancelled; below the threshold the queue is never held (suite-due.test.mjs)
- [2026-10-14 18:42] (comment) criterion added: wait.mjs prints a heartbeat (queue position or running time and command) every --heartbeat s; patch-worker has SendMessage and pings one line per landed job (heartbeat.test.mjs)
- [2026-10-14 18:42] (comment) ticked: runner: nextest runs a job's per-target cargo tests as one nextest invocation; filters, unfiltered runs, other packages and lone targets keep their own run (coalesce.test.mjs)
- [2026-10-14 18:42] (comment) ticked: Once suite_every landings accumulate, the suite runs before the next queued job and is not cancelled; below the threshold the queue is never held (suite-due.test.mjs)
- [2026-10-14 18:42] (comment) ticked: wait.mjs prints a heartbeat (queue position or running time and command) every --heartbeat s; patch-worker has SendMessage and pings one line per landed job (heartbeat.test.mjs)
- [2026-10-14 18:42] (comment) @claude: Measured on 195 dirt-empire jobs (46,257 s): game-crate compile 45-50 s per src change plus 27 s cfg(test) lib when --li (full comment #1 in ## Notes)
- [2026-10-14 18:42] (status) todo → review
- [2026-10-15 01:13] (comment) @claude: Incremental flip re-measure (dirt-empire 2f4ea20, 2026-10-14 19:50Z; read-only from target/broker/results). Still only 1 (full comment #2 in ## Notes)
- [2026-10-15 01:22] (comment) @claude: A/B (coordinator, dirt-empire, broker idle, 2026-10-14): touch crates/dirt-empire/src/lib.rs then 'cargo test --offline  (full comment #3 in ## Notes)
- [2026-10-15 01:36] (comment) @claude: Follow-ups. (1) Shared-target thrash: measured from dirt-empire logs (read-only), first command of each job by the job b (full comment #4 in ## Notes)
