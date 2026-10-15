---
id: KIT-T515
title: broker --pin can move a superproject gitlink BACKWARDS: a stiletto job submitted with --pin rapid-game=30c0b81b (then the origin tip) was st
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T16:25:20Z
updated: 2026-10-15T19:14:22Z
---

## Description
broker --pin can move a superproject gitlink BACKWARDS: a stiletto job submitted with --pin rapid-game=30c0b81b (then the origin tip) was still queued when a rapid-game landing pinned the superproject to 33f705fa; at land the job would commit the gitlink back to 30c0b81b, erasing the newer pin from main. Fix: at run time, refuse (or auto-advance to the recorded gitlink) any pin that is an ancestor of the superproject's recorded gitlink; pins may only move forward. Seen 2026-10-15 on j-mv9odvo1 (daemon stopped by the operator before it could land)

kit-bug-shape: cap:bug:broker-pin-can-move-a-superproject-gitlink-backw
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 16:25] (created) bug — broker --pin can move a superproject gitlink BACKWARDS: a stiletto job submitted with --pin rapid-game=30c0b81b (then the origin tip) was st
- [2026-10-15 17:28] (comment) @claude: Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from ze (full comment #1 in ## Notes)
### comment #1 [2026-10-15 17:28] @claude
Chris 2026-10-15 verbatim: "Let's fix thos gaps." (the three broker recovery gaps: interrupted test runs restart from zero (KIT-T518), Cargo.lock restore unproven (KIT-T519), a stale queued --pin moving a gitlink backwards (KIT-T515)).
- [2026-10-15 19:14] (comment) @claude: Fixed in 7ba827e (pushed). A landing --pin that is not equal to or a descendant of the HEAD gitlink is refused with stat (full comment #2 in ## Notes)
### comment #2 [2026-10-15 19:14] @claude
Fixed in 7ba827e (pushed). A landing --pin that is not equal to or a descendant of the HEAD gitlink is refused with status stale (phase pin, both shas named) at run time and again right before the commit; check-only jobs unaffected. Tests: scripts/broker/pin-stale.test.mjs 4 passed (queued old pin behind a newer landed pin moves nothing; descendant and equal pins still land; check-only old pin passes; gitlink advanced mid-run caught at land time), pin.test.mjs 9 passed. Broker suite 257 of 258 (one load-timing flake that passes alone).
- [2026-10-15 19:14] (status) todo → review
