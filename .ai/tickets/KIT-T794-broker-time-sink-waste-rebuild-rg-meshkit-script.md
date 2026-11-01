---
id: KIT-T794
title: broker time sink: waste rebuild rg-meshkit-script in dirt-empire/root
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:32:44Z
updated: 2026-11-01T22:37:31Z
---

## Description
waste rebuild rg-meshkit-script in dirt-empire/root: 0.0 min, 7% of its waste time, 0.0 min/job, worse (+46% per job), #2 (was #21)

kit-bug-shape: broker-blocker:dirt-empire|root|waste|rebuild rg-meshkit-script
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Verified 2026-11-01 from the dirt-empire timing profile (24 h window): waste rebuild rg-meshkit-script and -bevy are 0.1 min total over the window, 0.0 min/job, ranked #27 and #28 of the waste list, far under a twentieth of the lane's 1.5 min typical job. Fixed by 5338f42 (materiality gate, KIT-D127): tests timing-tick, timing-profile, timing-sample, timing-flagged, timing-dirty, timing-moved 29 passed at that commit; the same data no longer ticketed. Folded into the rolling ticket KIT-T816 (time sinks: dirt-empire/root) logic: rows below the gate are ranked in broker blockers only.

## History
- [2026-11-01 19:32] (created) bug — broker time sink: waste rebuild rg-meshkit-script in dirt-empire/root
- [2026-11-01 20:32] (comment) update in dirt-empire: no longer a top blocker (was #2): improved, corrected or gone quiet
- [2026-11-01 22:22] (comment) @kit-agent: kit-agent diagnosis 2026-11-01: common root cause across KIT-T764/T773/T774/T786/T788/T790/T794/T795. These are ranking  (full comment #1 in ## Notes)
### comment #1 [2026-11-01 22:22] @kit-agent
kit-agent diagnosis 2026-11-01: common root cause across KIT-T764/T773/T774/T786/T788/T790/T794/T795. These are ranking rows from the hourly timing tick (timing-tick.mjs, KIT-D121), not 5-minute breaches: in dirt-empire's recorded jobs no per-job row passes 3 min (rg-rig 3.0 min is one cold build; bike 0.9-1.4 min/job; wheeled_brake_hold 0.4-0.5 min/job from one 178 s verify command outside the diff's reach, job j-mvwlu2vi-gzs2my; rg-meshkit-script/-bevy rebuild is 1-2 s a job, dependency rebuilt). The filer ticketed the top three rows of every kind however small, and one command ranked as waste, crate and test gave 2-3 tickets. Fix: 5338f42 files only rows whose per-job cost is at least a twentieth of the lane's typical job (KIT-D127); the ranking in 'broker blockers' is unchanged. T794/T795 are resolved by the gate. Rows above the gate (rg-rig, bike, rg-graphics, wheeled_brake_hold scope) are real rankings with no kit defect: the remedy is a project test split or the KIT-Q005 lever 2B auto-skip, still gated on its own evidence.
- [2026-11-01 22:27] (status) todo → doing
- [2026-11-01 22:37] (status) doing → review
