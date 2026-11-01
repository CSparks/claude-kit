---
id: KIT-T802
title: broker time sink: waste rebuild track in dirt-empire/root
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T20:32:18Z
updated: 2026-11-01T22:06:49Z
---

## Description
waste rebuild track in dirt-empire/root: 0.3 min, 15% of its waste time, 0.0 min/job, better (-30% per job), #2 (was #10)

kit-bug-shape: broker-blocker:dirt-empire|root|waste|rebuild track
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Finding (standing kit agent, 2026-11-01): the look/track/truck/vehicle rebuilds are dependents of rg-physics, rebuilt because rg-physics sources changed since the shared target dir's last build ('dependency rebuilt' behind 'rg-physics: source changed'). Two causes: (1) jobs whose patch edits files inside the rapid-game submodule (diffStat shows only 'rapid-game | 0'), so timing-reach cannot place the edit and bills the rebuilt dependents as waste; (2) the next job reverting that patch (the edit/revert cycle of a shared target dir; content-align touches exactly the files whose content differs, so it adds no waste for identical content). Size: 0.5 min per crate per 24 h, about 4 min of waste in total against 26 min of crate time. Not yet fixed: accounting fix (expand submodule edits into diffStat, count the previous job's patch residue as moved) is designed, not built; the same-patch second-run cannot reach 0 compiles while the baseline run reverts the patch. Related: KIT-T810 (land gate dependents, d00f3db) is the larger waste of the same class.

## History
- [2026-11-01 20:32] (created) bug — broker time sink: waste rebuild track in dirt-empire/root
- [2026-11-01 21:32] (comment) seen again in dirt-empire: waste rebuild track in dirt-empire/root: 0.3 min, 14% of its waste time, 0.0 min/job, better (-42% per job), #2 (was #9)
- [2026-11-01 22:06] (status) todo → doing
