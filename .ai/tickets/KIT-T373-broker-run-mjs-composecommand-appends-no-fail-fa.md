---
id: KIT-T373
title: broker run.mjs composeCommand appends --no-fail-fast -j N AFTER the -- separator of a cargo test command, so libtest rejects the flags; both
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-06T15:08:22Z
updated: 2026-10-06T16:05:43Z
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
