---
id: KIT-T595
title: broker self-check stuck-inflight: j-mvfwmy8i-1xdsn5 (dirt-empire, 2026-10-20T00:02Z, daemon pid 58496 stalled 171s, 617s inflight)
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-20T00:02:35Z
updated: 2026-11-08T16:31:30Z
fixed_commit: ca3612f
---

## Description
broker self-check stuck-inflight: j-mvfwmy8i-1xdsn5 (dirt-empire, 2026-10-20T00:02Z, daemon pid 58496 stalled 171s, 617s inflight)

kit-bug-shape: cap:bug:broker-self-check-stuck-inflight-j-mvfwmy8i-1xds
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-20 00:02] (created) bug — broker self-check stuck-inflight: j-mvfwmy8i-1xdsn5 (dirt-empire, 2026-10-20T00:02Z, daemon pid 58496 stalled 171s, 617s inflight)
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) same stuck-inflight false-alarm family as KIT-T587: silence-based detector in scripts/broker/health.mjs; test scripts/broker/health-quiet.test.mjs (3 passed) and health/health-stale (24 passed)
- [2026-11-08 16:31] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
