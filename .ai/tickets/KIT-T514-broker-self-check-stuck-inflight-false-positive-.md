---
id: KIT-T514
title: broker self-check stuck-inflight false positive: alarm at 3x the longest RECENT command (176 s) while the job's cargo/cargo-nextest children
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T16:24:24Z
updated: 2026-10-15T16:24:24Z
---

## Description
broker self-check stuck-inflight false positive: alarm at 3x the longest RECENT command (176 s) while the job's cargo/cargo-nextest children were alive and a cold workspace build (Cargo.lock changed) was in progress (j-mv9odvo1, 2026-10-15 16:20Z). The check should look for a live child process and the heartbeat before alarming, and the limit should come from the longest build on record, not the last few commands

kit-bug-shape: cap:bug:broker-self-check-stuck-inflight-false-positive-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 16:24] (created) bug — broker self-check stuck-inflight false positive: alarm at 3x the longest RECENT command (176 s) while the job's cargo/cargo-nextest children
