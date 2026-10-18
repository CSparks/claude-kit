---
id: KIT-T562
title: broker: a pin-only job is refused with 'no operations', so workers smuggle a no-op README edit into every --pin job (2026-10-17 pins j-mvcxc
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-17T22:25:47Z
updated: 2026-10-18T01:39:58Z
---

## Description
broker: a pin-only job is refused with 'no operations', so workers smuggle a no-op README edit into every --pin job (2026-10-17 pins j-mvcxca8o, j-mvcy7dl7). A --pin with no ops must be a valid job.

kit-bug-shape: cap:bug:broker-a-pin-only-job-is-refused-with-no-operati
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
buildPatchJob: --pin with an empty envelope or --no-patch is a pin-only job (ops = []); admit.mjs allows --land with ops empty when pins exist. pin.test.mjs: both shapes land the gitlink alone; without --pin 'no operations' / 'cannot --land' stay. 10 passed.

## History
- [2026-10-17 22:25] (created) bug — broker: a pin-only job is refused with 'no operations', so workers smuggle a no-op README edit into every --pin job (2026-10-17 pins j-mvcxc
- [2026-10-18 01:39] (status) todo → review
