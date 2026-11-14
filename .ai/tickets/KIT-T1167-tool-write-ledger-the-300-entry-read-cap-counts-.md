---
id: KIT-T1167
title: tool-write ledger: the 300-entry read cap counts entries of every path, so a busy checkout evicts an owner's entry and re-blocks a legitimate rm
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T23:26:39Z
updated: 2026-11-14T00:10:15Z
---

## Description
hooks/lib/tool-write-ledger.mjs toolWriteEntries slices the newest 300 records of the whole checkout before any caller filters by path; 300 writes of other files push an owner's entry out and deleteRefusal answers unrecorded for a file the caller wrote. Fix: filter by path first, then cap. Reported by the earlier kit agent while closing KIT-T1156. kit-bug

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The 300-entry ledger read cap counts the asked path only; hooks/tool-writes-race.test.mjs 8 passed, 2 failed before (9b0bd9c)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T1156, KIT-T1138, KIT-T944
Fixed 9b0bd9c. hooks/tool-writes-race.test.mjs 8 passed (2 failed before). Chose filter-by-path-then-cap over scoping the read to the asking writer: deleteRefusal needs other writers entries.

## History
- [2026-11-13 23:26] (created) bug — tool-write ledger: the 300-entry read cap counts entries of every path, so a busy checkout evicts an owner's entry and re-blocks a legitimate rm
- [2026-11-13 23:46] (landed) 9b0bd9c tool-write ledger: the 300-entry read cap counts entries of the asked path only, so writes to other files in a busy chec
- [2026-11-14 00:09] (comment) criterion added: The 300-entry ledger read cap counts the asked path only; hooks/tool-writes-race.test.mjs 8 passed, 2 failed before (9b0bd9c)
- [2026-11-14 00:09] (comment) ticked: The 300-entry ledger read cap counts the asked path only; hooks/tool-writes-race.test.mjs 8 passed, 2 failed before (9b0bd9c)
- [2026-11-14 00:10] (status) todo → review
