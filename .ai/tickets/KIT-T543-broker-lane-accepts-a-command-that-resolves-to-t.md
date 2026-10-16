---
id: KIT-T543
title: broker lane accepts a command that resolves to the superproject workspace (rapid-game lane ran 'cargo t -p rg-physics' in the stiletto workspace)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:54Z
updated: 2026-10-16T14:57:54Z
---

## Description
mv9t5h60: 'cargo t -p rg-physics' without 'cd rust' ran in the stiletto workspace on the rapid-game lane. The lane should refuse at submit with a clear message, or root commands in its repo. Source: broker-vetting-2026-10-16 D7.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T516, KIT-T517, KIT-T522

## History
- [2026-10-16 14:57] (created) bug — broker lane accepts a command that resolves to the superproject workspace (rapid-game lane ran 'cargo t -p rg-physics' in the stiletto workspace)
