---
id: KIT-T497
title: cap refuses a capture as a duplicate of KIT-T271 even when KIT-T271 (and fixture ids T001/T003/T005) are named in --not-dup (stiletto-68, KIT-T488#4)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T21:42:39Z
updated: 2026-10-14T23:54:27Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T271, KIT-T488
### comment #1 [2026-10-14 23:54] @claude
Diagnosis: cap never refuses a capture and had no --not-dup flag; the flag (as its own args or inside the quoted text) became capture text, and the 'possible duplicates: KIT-T271 [todo] …' receipt lines read as a refusal. The stiletto capture did land: it is KIT-T495 (its description still carries the '--not-dup KIT-T488,…' text). Fixed: cap --not-dup <id,...> (own args or trailing in the text) strips the flag, leaves those ids out of the hints, records them on a kit ticket; the hint header says the capture is filed, not refused; usage says a capture is never refused. cap.test 41 passed (3 new). npm test exit 0.

## History
- [2026-10-14 21:42] (created) bug — cap refuses a capture as a duplicate of KIT-T271 even when KIT-T271 (and fixture ids T001/T003/T005) are named in --not-dup (stiletto-68, KIT-T488#4)
- [2026-10-14 23:54] (comment) @claude: Diagnosis: cap never refuses a capture and had no --not-dup flag; the flag (as its own args or inside the quoted text) b (full comment #1 in ## Notes)
- [2026-10-14 23:54] (status) todo → review
