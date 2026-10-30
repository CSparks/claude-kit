---
id: KIT-T487
title: q fts returns 'database is locked' under concurrent sessions (seen twice by a stiletto analyst 2026-10-14 before succeeding); q should retry or open read-only
type: bug
status: done
priority: high
milestone:
labels: []
links: []
files: []
supersedes: KIT-T720
superseded_by:
created: 2026-10-14T19:10:47Z
updated: 2026-10-30T04:21:48Z
fixed_commit: e2f32ec
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T430

## History
- [2026-10-14 19:10] (created) bug — q fts returns 'database is locked' under concurrent sessions (seen twice by a stiletto analyst 2026-10-14 before succeeding); q should retry or open read-only
- [2026-10-30 04:20] (status) → superseded (by KIT-T720)
- [2026-10-30 04:21] (status) superseded → todo
- [2026-10-30 04:21] (status) superseded → done
- [2026-10-30 04:22] (landed) e2f32ec q reads wait out SQLite lock contention instead of failing (implements KIT-T487; supersedes KIT-T720)
