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
