---
id: KIT-T801
title: broker time sink: waste rebuild look in dirt-empire/root
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T20:32:17Z
updated: 2026-11-01T23:01:19Z
---

## Description
waste rebuild look in dirt-empire/root: 0.3 min, 15% of its waste time, 0.0 min/job, better (-30% per job), #1 (was #9)

kit-bug-shape: broker-blocker:dirt-empire|root|waste|rebuild look
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Finding (standing kit agent, 2026-11-01): the look/track/truck/vehicle rebuilds are dependents of rg-physics, rebuilt because rg-physics sources changed since the shared target dir's last build ('dependency rebuilt' behind 'rg-physics: source changed'). Two causes: (1) jobs whose patch edits files inside the rapid-game submodule (diffStat shows only 'rapid-game | 0'), so timing-reach cannot place the edit and bills the rebuilt dependents as waste; (2) the next job reverting that patch (the edit/revert cycle of a shared target dir; content-align touches exactly the files whose content differs, so it adds no waste for identical content). Size: 0.5 min per crate per 24 h, about 4 min of waste in total against 26 min of crate time. Not yet fixed: accounting fix (expand submodule edits into diffStat, count the previous job's patch residue as moved) is designed, not built; the same-patch second-run cannot reach 0 compiles while the baseline run reverts the patch. Related: KIT-T810 (land gate dependents, d00f3db) is the larger waste of the same class.
Fixed in the commit that adds scripts/broker/diff-stat.mjs: patch.mjs and train.mjs record the diff stat through diffStatOf, which replaces a submodule's one-line entry with the files changed inside it (rapid-game/crates/.../lib.rs), so timing-reach places a rapid-game edit in its crate; samplesFromResults also treats the previous job's diff as moved (the shared target dir was built with that patch, reverting it rebuilds its crates). Tests: scripts/broker/diff-stat.test.mjs 3 passed (real submodule), timing-sample.test.mjs 8 passed incl. control. Measured: before 0.5 min per crate (look/track/truck/vehicle) per 24 h, about 4 min of waste against 26 min of crate time; historical result files carry the folded 'rapid-game | 0' stat, so 'broker blockers' still shows 0.5 min for the old window until it ages out; new jobs record expanded stats. The larger same-class waste is KIT-T810 (d00f3db).

## History
- [2026-11-01 20:32] (created) bug — broker time sink: waste rebuild look in dirt-empire/root
- [2026-11-01 21:32] (comment) seen again in dirt-empire: waste rebuild look in dirt-empire/root: 0.3 min, 14% of its waste time, 0.0 min/job, better (-42% per job), #1 (was #8)
- [2026-11-01 22:06] (status) todo → doing
- [2026-11-01 22:25] (landed) d4ea676 tickets T801-T805, T796, T797: findings so far on the dirt-empire waste rebuilds (implements KIT-T801; implements KIT-T8
- [2026-11-01 22:33] (comment) update in dirt-empire: no longer a top blocker (was #1): improved, corrected or gone quiet
- [2026-11-01 22:33] (comment) update in dirt-empire: no longer a top blocker (was #1): improved, corrected or gone quiet
- [2026-11-01 23:01] (status) doing → review
- [2026-11-01 23:01] (landed) aafd799 broker: a job's diff stat expands edited submodules to the files inside them, and the previous job's patch counts as mov
