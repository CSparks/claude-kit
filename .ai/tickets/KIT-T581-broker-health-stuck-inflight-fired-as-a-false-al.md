---
id: KIT-T581
title: broker health stuck-inflight fired as a false alarm while train-j-mvffr1g7-e5r9f1 ran a long legitimate root-lane build (440-500s, over 3x t
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T16:14:59Z
updated: 2026-10-20T00:51:52Z
fixed_commit: ca3612f
---

## Description
broker health stuck-inflight fired as a false alarm while train-j-mvffr1g7-e5r9f1 ran a long legitimate root-lane build (440-500s, over 3x the longest recent command of 400s); the job finished and my waiting job ran after it. Threshold should scale with the build in flight (cold compile), not the longest recent command. Seen 2026-10-19 during DE-T049 L1 wait.

kit-bug-shape: cap:bug:broker-health-stuck-inflight-fired-as-a-false-al
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 16:14] (created) bug — broker health stuck-inflight fired as a false alarm while train-j-mvffr1g7-e5r9f1 ran a long legitimate root-lane build (440-500s, over 3x t
- [2026-10-20 00:51] (status) todo → review
- [2026-10-20 00:51] (comment) same stuck-inflight false-alarm family as KIT-T587: silence-based detector in scripts/broker/health.mjs; test scripts/broker/health-quiet.test.mjs (3 passed) and health/health-stale (24 passed)
