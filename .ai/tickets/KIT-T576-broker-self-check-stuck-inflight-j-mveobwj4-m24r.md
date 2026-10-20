---
id: KIT-T576
title: broker self-check: stuck-inflight j-mveobwj4-m24rtq ran 1579s (>3x limit 671s) then cleared as a train; also own-fault restore-mismatch j-mv
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T03:41:22Z
updated: 2026-10-20T00:52:03Z
fixed_commit: ca3612f
---

## Description
broker self-check: stuck-inflight j-mveobwj4-m24rtq ran 1579s (>3x limit 671s) then cleared as a train; also own-fault restore-mismatch j-mvenv4o8-s6sdvw (ui/mod.rs, race/step.rs, tests/replay_flow.rs differ from journal after restore)

kit-bug-shape: cap:bug:broker-self-check-stuck-inflight-j-mveobwj4-m24r
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 03:41] (created) bug — broker self-check: stuck-inflight j-mveobwj4-m24rtq ran 1579s (>3x limit 671s) then cleared as a train; also own-fault restore-mismatch j-mv
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) same stuck-inflight false-alarm family as KIT-T587: silence-based detector in scripts/broker/health.mjs; test scripts/broker/health-quiet.test.mjs (3 passed) and health/health-stale (24 passed)
