---
id: KIT-T747
title: broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 41.2 min of 41.2 min total, 6.5 min of it queued for the machine
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T00:52:13Z
updated: 2026-10-31T00:52:13Z
---

## Description
broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 41.2 min of 41.2 min total, 6.5 min of it queued for the machine build slot; commands ran 34.6 min; job train-j-mvvn7vtm-mskze7 (DE-T228 DE-T264 DE-T241), status passed/landed; split, scope or speed up that phase

kit-bug-shape: cap:bug:broker-job-over-the-5-minute-ceiling-kit-d104-ra
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Same root cause as KIT-T742: the removed fixed-ceiling filer (overrun.mjs) still ran in runtime 773fb4a; HEAD (KIT-D121, e17b1a2/262142e) has no such filer, so a 41-minute rapid-game run phase now shows in the timing profile as measured waste (broker blockers) instead of a ticket per job. Fixed by publishing the runtime at HEAD. Evidence: timing 20 passed (21c2099).

## History
- [2026-10-31 00:52] (created) bug — broker job over the 5-minute ceiling (KIT-D104): rapid-game run phase took 41.2 min of 41.2 min total, 6.5 min of it queued for the machine
