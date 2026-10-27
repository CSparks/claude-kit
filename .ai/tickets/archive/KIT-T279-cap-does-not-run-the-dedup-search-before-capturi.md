---
id: KIT-T279
title: cap does not run the dedup search before capturing
type: bug
status: done
priority: high
milestone:
labels: [lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:04:10Z
updated: 2026-10-27T22:27:24Z
---

## Description
cap now runs the KIT-T025 similar search before writing (scripts/cap-dedup.mjs), scoped via a new 'similar --scopes A,B' to the project key plus adopted framework stores (scripts/q-framework.mjs); lines print under the receipt; fail-open, skipped for --done. Verified live in stiletto: 'puppet camps' lists ST-T683 first. Tests: scripts/cap.test.mjs KIT-T279 block (2 fail before, 38 pass after); scripts/q.test.mjs 94 pass.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] cap prints likely duplicate tickets from the project + framework store in its receipt, never blocking the capture

## Plan
1.

## History
- [2026-10-02 15:04] (created) bug — cap does not run the dedup search before capturing
- [2026-10-02 15:11] (comment) criterion added: cap prints likely duplicate tickets from the project + framework store in its receipt, never blocking the capture
- [2026-10-02 15:11] (comment) ticked: cap prints likely duplicate tickets from the project + framework store in its receipt, never blocking the capture
- [2026-10-02 15:11] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
