---
id: KIT-T582
title: broker HEALTH stuck-inflight: train-j-mvffr1g7-e5r9f1 inflight 451-496s (nextest of 14 test bins ran 133s but job shown inflight >3x limit;
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T16:18:42Z
updated: 2026-10-20T00:51:57Z
fixed_commit: ca3612f
---

## Description
broker HEALTH stuck-inflight: train-j-mvffr1g7-e5r9f1 inflight 451-496s (nextest of 14 test bins ran 133s but job shown inflight >3x limit; later jobs still proceeded)

kit-bug-shape: cap:bug:broker-health-stuck-inflight-train-j-mvffr1g7-e5
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 16:18] (created) bug — broker HEALTH stuck-inflight: train-j-mvffr1g7-e5r9f1 inflight 451-496s (nextest of 14 test bins ran 133s but job shown inflight >3x limit;
- [2026-10-20 00:51] (status) todo → review
- [2026-10-20 00:51] (comment) same stuck-inflight false-alarm family as KIT-T587: silence-based detector in scripts/broker/health.mjs; test scripts/broker/health-quiet.test.mjs (3 passed) and health/health-stale (24 passed)
