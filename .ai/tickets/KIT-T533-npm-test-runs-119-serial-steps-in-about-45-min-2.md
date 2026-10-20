---
id: KIT-T533
title: npm test runs 119 serial steps in about 45 min (2687 s). Split test:chain into the broker glob lane (about 14 min) and the rest (about 33 mi
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T23:28:55Z
updated: 2026-10-15T23:28:55Z
---

## Description
npm test runs 119 serial steps in about 45 min (2687 s). Split test:chain into the broker glob lane (about 14 min) and the rest (about 33 min) and run both at once in run-tests.mjs; the lanes share no state. Also look at hooks/sync-data.test.mjs (289 s). Measured by the KIT-T532 writer, 50f1c84.

kit-bug-shape: cap:feature:npm-test-runs-119-serial-steps-in-about-45-min-2
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 23:28] (created) feature — npm test runs 119 serial steps in about 45 min (2687 s). Split test:chain into the broker glob lane (about 14 min) and the rest (about 33 mi
