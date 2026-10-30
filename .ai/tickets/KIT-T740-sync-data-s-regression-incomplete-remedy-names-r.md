---
id: KIT-T740
title: sync-data's REGRESSION INCOMPLETE remedy names regressed_from|causing_commit even when the gap is a done regression missing fixed_commit (dirt-empire DE-T098/T115/T130/T131/T134/T138 after the KIT-D107 lapse)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T23:27:21Z
updated: 2026-10-30T23:27:21Z
---

## Description
After the SessionStart review lapse (KIT-D107) moved review tickets to done, the sync-data integrity gate blocked on done regressions missing fixed_commit. Its remedy line named t link regressed_from|causing_commit and left out fixed_commit. Fix: each gap carries its rel; the remedy is built from the gaps (regressionRemedy in scripts/id-utils.mjs).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T066, KIT-T393, KIT-T530

## History
- [2026-10-30 23:27] (created) bug — sync-data's REGRESSION INCOMPLETE remedy names regressed_from|causing_commit even when the gap is a done regression missing fixed_commit (dirt-empire DE-T098/T115/T130/T131/T134/T138 after the KIT-D107 lapse)
