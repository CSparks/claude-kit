---
id: KIT-T763
title: broker time sink: phase queue in dirt-empire/rapid-game
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: [KIT-D121]
files: []
supersedes:
superseded_by:
created: 2026-10-31T02:24:26Z
updated: 2026-11-01T22:36:40Z
---

## Description
phase queue in dirt-empire/rapid-game: 126.5 min, 36% of its phase time, 2.1 min/job, worse (+117% per job), #3 (was #7)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|phase|queue
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-31 02:24] (created) bug — broker time sink: phase queue in dirt-empire/rapid-game
- [2026-10-31 02:24] (comment) seen again in dirt-empire: phase queue in dirt-empire/rapid-game: 126.5 min, 36% of its phase time, 2.1 min/job, worse (+117% per job), #3 (was #7)
- [2026-10-31 16:16] (comment) seen again in dirt-empire: phase queue in dirt-empire/rapid-game: 74.3 min, 32% of its phase time, 2.8 min/job, worse (+97% per job), #3 (was #5)
- [2026-10-31 16:19] (comment) seen again in dirt-empire: phase queue in dirt-empire/rapid-game: 73.8 min, 32% of its phase time, 2.8 min/job, worse (+105% per job), #3 (was #5)
- [2026-10-31 17:19] (comment) seen again in dirt-empire: phase queue in dirt-empire/rapid-game: 80.0 min, 33% of its phase time, 2.8 min/job, worse (+100% per job), #3 (was #4)
- [2026-10-31 18:18] (comment) seen again in dirt-empire: phase queue in dirt-empire/rapid-game: 79.7 min, 34% of its phase time, 3.1 min/job, worse (+150% per job), #3 (was #7)
- [2026-11-01 15:37] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 15:37] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 22:36] (status) todo → superseded
- [2026-11-01 22:36] (comment) @kit-agent: Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical  (full comment #1 in ## Notes)
### comment #1 [2026-11-01 22:36] @kit-agent
Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical job). The broker tick lists material sinks in one rolling ticket per lane and opens 'time sinks: dirt-empire/rapid-game' when one appears.
