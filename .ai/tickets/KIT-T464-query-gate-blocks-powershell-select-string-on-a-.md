---
id: KIT-T464
title: query-gate blocks PowerShell Select-String on a scratchpad log file (not source) while bash grep on the same file is allowed: inconsistent g
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T02:52:17Z
updated: 2026-10-14T03:28:28Z
fixed_commit: 605ab34
---

## Description
query-gate blocks PowerShell Select-String on a scratchpad log file (not source) while bash grep on the same file is allowed: inconsistent gate scope (reported by DE-T131 writer 12, 2026-10-13)

kit-bug-shape: cap:bug:query-gate-blocks-powershell-select-string-on-a-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 02:52] (created) bug — query-gate blocks PowerShell Select-String on a scratchpad log file (not source) while bash grep on the same file is allowed: inconsistent g
- [2026-10-14 03:28] (comment) @claude: Fixed 605ab34; test: node hooks/query-gate.test.mjs (all pass, 7 new scratchpad/source cases both shells); full npm test green.
- [2026-10-14 03:28] (status) todo → review
- [2026-10-14 03:28] (comment) test: hooks/query-gate.test.mjs all pass
