---
id: KIT-T459
title: t move and triage --apply mint ids without the atomic id reservation
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T20:41:00Z
updated: 2026-10-13T22:28:31Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 20:41] (created) bug — t move and triage --apply mint ids without the atomic id reservation
- [2026-10-13 22:28] (comment) @claude: (fixed) fb24e6c. Test evidence: scripts/id-reserve-callers.test.mjs 6 passed (4 concurrent t move + 4 concurrent triage  (full comment #1 in ## Notes)
### comment #1 [2026-10-13 22:28] @claude
(fixed) fb24e6c. Test evidence: scripts/id-reserve-callers.test.mjs 6 passed (4 concurrent t move + 4 concurrent triage mints, distinct ids); mutation: unreserved t-move/apply fails 2-4 of 6; npm test green
- [2026-10-13 22:28] (status) todo → review
