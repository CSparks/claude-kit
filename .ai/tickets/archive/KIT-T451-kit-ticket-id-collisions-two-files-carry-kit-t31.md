---
id: KIT-T451
title: Kit ticket id collisions: two files carry KIT-T317 (broker --no-patch feature, lagomurcei process failure) and two carry KIT-T409 (pre-write
type: bug
status: done
priority: critical
asked: 2
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes: KIT-T340
superseded_by:
created: 2026-10-13T19:51:49Z
updated: 2026-10-27T22:27:25Z
---

## Description
Kit ticket id collisions: two files carry KIT-T317 (broker --no-patch feature, lagomurcei process failure) and two carry KIT-T409 (pre-write and tree-liveness hook crashes). Parallel sessions allocating ids concurrently; id allocation is not atomic across sessions.

kit-bug-shape: cap:bug:kit-ticket-id-collisions-two-files-carry-kit-t31
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 19:51] (created) bug — Kit ticket id collisions: two files carry KIT-T317 (broker --no-patch feature, lagomurcei process failure) and two carry KIT-T409 (pre-write
- [2026-10-13 19:52] (comment) seen again in stiletto-2349: Kit ticket id collisions: two files carry KIT-T317 (broker --no-patch feature; lagomurcei process failure) and two carry KIT-T409 (pre-write and tree-liveness hook crashes).
- [2026-10-13 19:52] (asked again) 2026-10-13 — cap:bug:kit-ticket-id-collisions-two-files-carry-kit-t31
- [2026-10-13 20:34] (status) todo → review
- [2026-10-13 20:34] (comment) dd5aecb bf82a08; scripts/id-reserve.test.mjs 4 passed; check-ids clean; npm test exit 0
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
