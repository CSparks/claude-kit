---
id: KIT-T373
title: broker run.mjs composeCommand appends --no-fail-fast -j N AFTER the -- separator of a cargo test command, so libtest rejects the flags; both
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T15:08:22Z
updated: 2026-10-27T22:27:25Z
---

## Description
broker run.mjs composeCommand appends --no-fail-fast -j N AFTER the -- separator of a cargo test command, so libtest rejects the flags; both must go before --

kit-bug-shape: cap:bug:broker-run-mjs-composecommand-appends-no-fail-fa
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-06 15:08] (created) bug — broker run.mjs composeCommand appends --no-fail-fast -j N AFTER the -- separator of a cargo test command, so libtest rejects the flags; both
- [2026-10-06 16:05] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
