---
id: KIT-T788
title: broker time sink: test rg-rig --lib in dirt-empire/rapid-game
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: [KIT-D121]
files: []
supersedes: KIT-T789
superseded_by:
created: 2026-11-01T16:36:53Z
updated: 2026-11-01T22:36:50Z
---

## Description
test rg-rig --lib in dirt-empire/rapid-game: 5.9 min, 32% of its test time, 2.0 min/job, worse (+9582% per job), #2 (was #51)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|test|rg-rig --lib
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-01 16:36] (created) bug — broker time sink: test rg-rig --lib in dirt-empire/rapid-game
- [2026-11-01 19:32] (comment) seen again in dirt-empire: test rg-rig --lib in dirt-empire/rapid-game: 3.0 min, 100% of its test time, 3.0 min/job, worse (+1889% per job), #1 (was #26)
- [2026-11-01 20:32] (comment) seen again in dirt-empire: test rg-rig --lib in dirt-empire/rapid-game: 3.0 min, 100% of its test time, 3.0 min/job, worse (+1640% per job), #3 (was #25)
- [2026-11-01 21:32] (comment) seen again in dirt-empire: test rg-rig --lib in dirt-empire/rapid-game: 3.1 min, 93% of its test time, 0.8 min/job, worse (+266% per job), #3 (was #25)
- [2026-11-01 22:22] (comment) @kit-agent: kit-agent diagnosis 2026-11-01: common root cause across KIT-T764/T773/T774/T786/T788/T790/T794/T795. These are ranking  (full comment #1 in ## Notes)
### comment #1 [2026-11-01 22:22] @kit-agent
kit-agent diagnosis 2026-11-01: common root cause across KIT-T764/T773/T774/T786/T788/T790/T794/T795. These are ranking rows from the hourly timing tick (timing-tick.mjs, KIT-D121), not 5-minute breaches: in dirt-empire's recorded jobs no per-job row passes 3 min (rg-rig 3.0 min is one cold build; bike 0.9-1.4 min/job; wheeled_brake_hold 0.4-0.5 min/job from one 178 s verify command outside the diff's reach, job j-mvwlu2vi-gzs2my; rg-meshkit-script/-bevy rebuild is 1-2 s a job, dependency rebuilt). The filer ticketed the top three rows of every kind however small, and one command ranked as waste, crate and test gave 2-3 tickets. Fix: 5338f42 files only rows whose per-job cost is at least a twentieth of the lane's typical job (KIT-D127); the ranking in 'broker blockers' is unchanged. T794/T795 are resolved by the gate. Rows above the gate (rg-rig, bike, rg-graphics, wheeled_brake_hold scope) are real rankings with no kit defect: the remedy is a project test split or the KIT-Q005 lever 2B auto-skip, still gated on its own evidence.
- [2026-11-01 22:33] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 22:33] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 22:36] (status) todo → superseded
- [2026-11-01 22:36] (comment) @kit-agent: Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical  (full comment #2 in ## Notes)
### comment #2 [2026-11-01 22:36] @kit-agent
Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical job). The broker tick lists material sinks in one rolling ticket per lane and opens 'time sinks: dirt-empire/rapid-game' when one appears.
