---
id: KIT-T762
title: broker time sink: waste repeat test->test different flags in dirt-empire/rapid-game
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: [KIT-D121]
files: []
supersedes:
superseded_by:
created: 2026-10-31T02:24:25Z
updated: 2026-11-01T22:36:36Z
---

## Description
waste repeat test->test different flags in dirt-empire/rapid-game: 17.2 min, 16% of its waste time, 0.3 min/job, worse (+8004% per job), #3 (was #266)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|waste|repeat test->test different flags
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-31 02:24] (created) bug — broker time sink: waste repeat test->test different flags in dirt-empire/rapid-game
- [2026-10-31 02:24] (comment) seen again in dirt-empire: waste repeat test->test different flags in dirt-empire/rapid-game: 17.2 min, 16% of its waste time, 0.3 min/job, worse (+8004% per job), #3 (was #266)
- [2026-10-31 16:16] (comment) seen again in dirt-empire: waste repeat test->test different flags in dirt-empire/rapid-game: 15.4 min, 21% of its waste time, 0.6 min/job, worse (+1678% per job), #3 (was #26)
- [2026-10-31 16:19] (comment) seen again in dirt-empire: waste repeat test->test different flags in dirt-empire/rapid-game: 15.4 min, 22% of its waste time, 0.6 min/job, worse (+1777% per job), #3 (was #25)
- [2026-10-31 17:19] (comment) seen again in dirt-empire: waste repeat test->test different flags in dirt-empire/rapid-game: 15.4 min, 21% of its waste time, 0.5 min/job, worse (+1583% per job), #3 (was #25)
- [2026-10-31 18:18] (comment) seen again in dirt-empire: waste repeat test->test different flags in dirt-empire/rapid-game: 15.4 min, 20% of its waste time, 0.6 min/job, worse (+1839% per job), #3 (was #26)
- [2026-11-01 15:37] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 15:37] (comment) update in dirt-empire: no longer a top blocker (was #3): improved, corrected or gone quiet
- [2026-11-01 22:36] (status) todo → superseded
- [2026-11-01 22:36] (comment) @kit-agent: Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical  (full comment #1 in ## Notes)
### comment #1 [2026-11-01 22:36] @kit-agent
Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical job). The broker tick lists material sinks in one rolling ticket per lane and opens 'time sinks: dirt-empire/rapid-game' when one appears.
