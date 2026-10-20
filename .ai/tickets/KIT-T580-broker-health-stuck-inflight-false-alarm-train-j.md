---
id: KIT-T580
title: broker HEALTH stuck-inflight false alarm: train-j-mvffr1g7-e5r9f1 passed in 64s+93s of commands but wait printed ~35 'stuck-inflight ... ove
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T16:12:26Z
updated: 2026-10-20T00:51:55Z
fixed_commit: ca3612f
---

## Description
broker HEALTH stuck-inflight false alarm: train-j-mvffr1g7-e5r9f1 passed in 64s+93s of commands but wait printed ~35 'stuck-inflight ... over 3x the longest recent command (400s limit)' lines at 400-500s inflight while commands 4-5 ran; train of 3-4 patches with several test commands

kit-bug-shape: cap:bug:broker-health-stuck-inflight-false-alarm-train-j
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 16:12] (created) bug — broker HEALTH stuck-inflight false alarm: train-j-mvffr1g7-e5r9f1 passed in 64s+93s of commands but wait printed ~35 'stuck-inflight ... ove
- [2026-10-20 00:51] (status) todo → review
- [2026-10-20 00:51] (comment) same stuck-inflight false-alarm family as KIT-T587: silence-based detector in scripts/broker/health.mjs; test scripts/broker/health-quiet.test.mjs (3 passed) and health/health-stale (24 passed)
