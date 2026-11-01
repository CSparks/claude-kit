---
id: KIT-Q004
status: resolved
answerable_by: chris   # chris | claude  (see config.yml classifications.question)
created: 2026-10-30T23:26:30.700Z
---

**Q:** Does machine-build-slot queue time count toward the KIT-D104 five-minute ceiling, and should a job hold its slot across all its commands (amends KIT-D105)?

Evidence, 2026-10-30, dirt-empire broker (results over 300 s: 49 jobs in the root lane, 22 in the rapid-game lane): of 15176 s of command wall time in the root lane, 4099 s (27%) was queued for the slot; in the rapid-game lane 5169 of 6421 s (80%). A job re-queues behind every other lane's commands before EACH cargo command (train-j-mvvj5a05: 8 commands, 850 s queued, 650 s ran; j-mvvhpa3s: waits 100 s, 100 s, 53 s for three consecutive commands of one job, the last of which ran 16 s). The overrun reporter files one kit bug per such job, so contention appears as hundreds of comments on KIT-T645/T649 with no kit defect behind them.

Options:
(A) Keep D105 per-command slots; the reporter files only when the job's own time (total minus queued) passes five minutes, and queue minutes are reported in broker metrics only. Cuts the noise; the wait stays.
(B) Amend D105: a job takes its slot once, for its whole run phase. Fewer re-queues, lower mean job latency (first-come job-level order beats per-command round robin), but one long job blocks every other lane for its whole run.
(C) Leave both as they are and keep filing every queued overrun.

Recommend A now, B after measuring. Compile cost inside the jobs is the project's own: dirt-empire's test commands build 17-32 crates in the optimized+debuginfo test profile (346 s for one audio run) and single GPU tests run 140-190 s (free_ride_drive_tour); no kit lever there.

**Resolution:** (2026-10-31, chris) A (maintainer, 2026-10-30): keep KIT-D105 per-command slots; the overrun reporter files only when a job's own time (total minus slot-queue minutes) passes five minutes; queue minutes go to broker metrics only. Revisit B (job holds slot for its run) after measuring.

<!-- One question per file (atomic — KIT-D009). IDs KIT-Q### (e.g. KIT-Q001). Claude answers
     the answerable_by: claude ones from code/decisions and sets status: resolved; chris-only
     ones are surfaced batched at natural breaks. Allocate ids with next-id.mjs (KIT-T009). -->

## History
- [2026-10-31 00:10] (resolved) chris
