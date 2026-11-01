---
id: KIT-T796
title: broker time sink: phase command in dirt-empire/rapid-game
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T19:32:47Z
updated: 2026-11-01T23:12:39Z
---

## Description
phase command in dirt-empire/rapid-game: 0.9 min, 23% of its phase time, 0.9 min/job, better (-48% per job), #2 (was #7)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|phase|command
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Claimed by the standing kit agent (KIT-D123 hand-off from dirt-empire-83); investigation in progress.
Not yet investigated (rapid-game lane command phase); will resolve into T797 and the crate items.
Same cause and fix as KIT-T804 (e7550c8), rapid-game lane: phase command 1.9 min/24 h before, 0.0 after; phase queue 2.9 min before, 0.0 after (a landing replaying another job's run billed that run's slot wait again). Remaining rapid-game time is compile 1.8 min and test 0.3 min per 24 h, honest and small. Tests: timing-sample 9 passed.

## History
- [2026-11-01 19:32] (created) bug — broker time sink: phase command in dirt-empire/rapid-game
- [2026-11-01 20:32] (comment) update in dirt-empire: no longer a top blocker (was #2): improved, corrected or gone quiet
- [2026-11-01 22:06] (status) todo → doing
- [2026-11-01 23:12] (landed) e7550c8 broker timing: a landing's own check-tree run is no longer stamped as a reused run, and the profile counts only commands
- [2026-11-01 23:12] (status) doing → review
