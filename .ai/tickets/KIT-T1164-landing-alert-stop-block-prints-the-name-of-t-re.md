---
id: KIT-T1164
title: landing-alert Stop block prints the name of t receipt, not the receipt skeleton
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T23:03:02Z
updated: 2026-11-13T23:19:29Z
---

## Description
Prevention for a process failure of the road-generator orchestrator (landing reply ended without the receipt although t receipt exists since KIT-T1144). The Stop block prints the same receipt lines t receipt prints (sha, subject, ticket ids, push state, the one line to fill), capped at the 12 newest commits with a count of the rest, so a blocked reply is completed from the block text alone. Reuses hooks/lib/landed-commits.mjs and a shared hooks/lib/receipt-lines.mjs that scripts/t-receipt.mjs imports.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The landing-alert Stop block prints the receipt skeleton lines (sha, subject, ticket ids, push state) and the line to fill, the 12 newest commits and a count of the rest, from a formatter shared with t receipt (hooks/land-alert.test.mjs 28 passed incl. a repo with no remote and a 15-commit series; t-receipt 9 passed; 81c5e93)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T1144

## History
- [2026-11-13 23:03] (created) bug — landing-alert Stop block prints the name of t receipt, not the receipt skeleton
- [2026-11-13 23:04] (landed) 81c5e93 land-alert: the Stop block prints the receipt skeleton itself (the lines t receipt prints: sha, subject, ticket ids, pus
- [2026-11-13 23:19] (comment) criterion added: The landing-alert Stop block prints the receipt skeleton lines (sha, subject, ticket ids, push state) and the line to fill, the 12 newest commits and a count of the rest, from a formatter shared with t receipt (hooks/land-alert.test.mjs 28 passed incl. a repo with no remote and a 15-commit series; t-receipt 9 passed; 81c5e93)
- [2026-11-13 23:19] (comment) ticked: The landing-alert Stop block prints the receipt skeleton lines (sha, subject, ticket ids, push state) and the line to fill, the 12 newest commits and a count of the rest, from a formatter shared with t receipt (hooks/land-alert.test.mjs 28 passed incl. a repo with no remote and a 15-commit series; t-receipt 9 passed; 81c5e93)
- [2026-11-13 23:19] (comment) @claude: (fixed) 81c5e93; land-alert.test.mjs 28 passed, t-receipt.test.mjs 9 passed
- [2026-11-13 23:19] (status) todo → review
