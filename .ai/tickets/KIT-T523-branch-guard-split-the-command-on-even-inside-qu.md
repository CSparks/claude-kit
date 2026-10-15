---
id: KIT-T523
title: branch-guard split the command on ; & | even inside quotes, so git text in a quoted argument of another program was blocked as a second branch; now quote-aware
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T18:27:26Z
updated: 2026-10-15T18:27:44Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T082, KIT-T115, KIT-T387

## History
- [2026-10-15 18:27] (created) bug — branch-guard split the command on ; & | even inside quotes, so git text in a quoted argument of another program was blocked as a second branch; now quote-aware
- [2026-10-15 18:27] (comment) @claude: fixed: hooks/branch-guard.mjs uses the quote-aware segments(); hooks/branch-guard.test.mjs 44 passed with controls (real git branch after a quoted arg and git branch -f still block)
- [2026-10-15 18:27] (status) todo → review
