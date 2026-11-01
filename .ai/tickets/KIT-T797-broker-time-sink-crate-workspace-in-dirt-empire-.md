---
id: KIT-T797
title: broker time sink: crate (workspace) in dirt-empire/rapid-game
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:32:48Z
updated: 2026-11-01T23:12:44Z
---

## Description
crate (workspace) in dirt-empire/rapid-game: 0.8 min, 21% of its crate time, 0.8 min/job, worse (+120% per job), #2 (was #12)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|crate|(workspace)
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Not yet investigated.
Measured: crate (workspace) in dirt-empire/rapid-game is 1.2 min per 24 h (0.2 min/job, better -54%), rank #10, workspace-wide cargo commands of the rapid-game lane; honest work (no waste or rebuild entries in that lane beyond the accounting fixed in aafd799/e7550c8). Replays of other jobs' runs that inflated the lane (rg-rig 3.1 min -> 0.1 min, queue 2.9 -> 0.0) are gone after e7550c8. No broker lever; project lever: none material.

## History
- [2026-11-01 19:32] (created) bug — broker time sink: crate (workspace) in dirt-empire/rapid-game
- [2026-11-01 20:32] (comment) update in dirt-empire: no longer a top blocker (was #2): improved, corrected or gone quiet
- [2026-11-01 22:06] (status) todo → doing
- [2026-11-01 23:12] (landed) e7550c8 broker timing: a landing's own check-tree run is no longer stamped as a reused run, and the profile counts only commands
- [2026-11-01 23:12] (status) doing → review
