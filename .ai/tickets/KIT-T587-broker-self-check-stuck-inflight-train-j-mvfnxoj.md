---
id: KIT-T587
title: broker self-check stuck-inflight: train-j-mvfnxojf-7xxtys flagged inflight 370s+ (3x longest command) while a normal dirt-empire train (heat
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T19:55:53Z
updated: 2026-10-20T00:51:32Z
fixed_commit: ca3612f
---

## Description
broker self-check stuck-inflight: train-j-mvfnxojf-7xxtys flagged inflight 370s+ (3x longest command) while a normal dirt-empire train (heat_determinism then vehicle_dynamics) was red; likely a command hung after failure

kit-bug-shape: cap:bug:broker-self-check-stuck-inflight-train-j-mvfnxoj
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 19:55] (created) bug — broker self-check stuck-inflight: train-j-mvfnxojf-7xxtys flagged inflight 370s+ (3x longest command) while a normal dirt-empire train (heat
- [2026-10-20 00:51] (status) todo → review
- [2026-10-20 00:51] (comment) stuck-inflight now judges silence (no command-log write for 3x the longest recent command), not run age; tests scripts/broker/health-quiet.test.mjs 3 passed + health/health-stale 24 passed; wait.mjs default 100 s ends with exit 2 instead of a 120 s Bash kill (exit 137)
