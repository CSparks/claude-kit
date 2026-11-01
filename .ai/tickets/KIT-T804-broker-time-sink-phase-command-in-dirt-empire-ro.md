---
id: KIT-T804
title: broker time sink: phase command in dirt-empire/root
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T20:32:20Z
updated: 2026-11-01T22:06:57Z
---

## Description
phase command in dirt-empire/root: 8.7 min, 41% of its phase time, 1.0 min/job, worse (+237% per job), #1 (was #8)

kit-bug-shape: broker-blocker:dirt-empire|root|phase|command
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Command phase of dirt-empire/root resolves into the crate and waste items (T801-T803, T810); no separate cause found yet; not yet broken down by crate and test.

## History
- [2026-11-01 20:32] (created) bug — broker time sink: phase command in dirt-empire/root
- [2026-11-01 21:32] (comment) seen again in dirt-empire: phase command in dirt-empire/root: 8.7 min, 35% of its phase time, 0.7 min/job, worse (+675% per job), #1 (was #10)
- [2026-11-01 22:06] (status) todo → doing
