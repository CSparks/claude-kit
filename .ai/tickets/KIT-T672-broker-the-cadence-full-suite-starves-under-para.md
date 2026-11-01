---
id: KIT-T672
title: broker: the cadence full suite starves under parallel agent load: set to run every 10 landings, it is cancelled whenever a job queues (dirt-
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T18:11:10Z
updated: 2026-10-28T18:11:10Z
---

## Description
broker: the cadence full suite starves under parallel agent load: set to run every 10 landings, it is cancelled whenever a job queues (dirt-empire 2026-10-28: suite b5ea35b cancelled twice; last run 32db3f8 RED, ~16 landings since unverified as a whole). Needs a guaranteed suite slot (preempt after N landings, or batch the suite with queued checks).

kit-bug-shape: cap:bug:broker-the-cadence-full-suite-starves-under-para
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 18:11] (created) bug — broker: the cadence full suite starves under parallel agent load: set to run every 10 landings, it is cancelled whenever a job queues (dirt-
