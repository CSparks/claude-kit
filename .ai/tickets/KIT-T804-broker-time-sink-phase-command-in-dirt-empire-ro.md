---
id: KIT-T804
title: broker time sink: phase command in dirt-empire/root
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T20:32:20Z
updated: 2026-11-01T23:12:37Z
---

## Description
phase command in dirt-empire/root: 8.7 min, 41% of its phase time, 1.0 min/job, worse (+237% per job), #1 (was #8)

kit-bug-shape: broker-blocker:dirt-empire|root|phase|command
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Command phase of dirt-empire/root resolves into the crate and waste items (T801-T803, T810); no separate cause found yet; not yet broken down by crate and test.
Cause (measured 24 h, dirt-empire/root, before/after on the same result files): the 'command' phase held 38.5 min (50% of phase time) because a landing's own check-tree run (same job id, kept private) was stamped reusedFrom=<its own id>, and the profile's compile/test split returns zero for any reusedFrom command, so every gated land command fell into 'command'; a landing replaying another job's green run also counted that run's duration and queue again. Fix e7550c8: patch.mjs stamps reusedFrom only when the evidence came from another job; timing-sample counts a marked command only when its log was written by that job and counts a replay of another job's log as nothing; cargo t is a test command. After: phase command 0.0 min; compile 38.6 min (1.5 min/job) and test 27.9 min (1.1 min/job) are the honest work of the gated landings (project lever: dirt-empire test targets, see the lane ticket KIT-T816). Tests: timing-sample 9 passed, check-tree 7 passed (landing commands carry no reuse mark), green/landgate/stats/metrics/patch passed.

## History
- [2026-11-01 20:32] (created) bug — broker time sink: phase command in dirt-empire/root
- [2026-11-01 21:32] (comment) seen again in dirt-empire: phase command in dirt-empire/root: 8.7 min, 35% of its phase time, 0.7 min/job, worse (+675% per job), #1 (was #10)
- [2026-11-01 22:06] (status) todo → doing
- [2026-11-01 22:33] (comment) seen again in dirt-empire: phase command in dirt-empire/root: 31.1 min, 53% of its phase time, 1.6 min/job, worse (+1362% per job), #1 (was #10)
- [2026-11-01 22:33] (comment) seen again in dirt-empire: phase command in dirt-empire/root: 31.1 min, 50% of its phase time, 1.5 min/job, worse (+1292% per job), #1 (was #10)
- [2026-11-01 23:12] (landed) e7550c8 broker timing: a landing's own check-tree run is no longer stamped as a reused run, and the profile counts only commands
- [2026-11-01 23:12] (status) doing → review
