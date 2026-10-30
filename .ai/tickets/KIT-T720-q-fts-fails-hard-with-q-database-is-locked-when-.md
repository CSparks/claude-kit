---
id: KIT-T720
title: q fts fails hard with 'q: database is locked' when a second q runs back-to-back or another session holds the store (seen 2026-10-30 in dirt-
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T487
created: 2026-10-30T04:14:06Z
updated: 2026-10-30T04:14:06Z
---

## Description
q fts fails hard with 'q: database is locked' when a second q runs back-to-back or another session holds the store (seen 2026-10-30 in dirt-empire: two q fts calls in one PowerShell line, the second died). q should open SQLite read-only with a busy_timeout and retry, not exit 1

kit-bug-shape: cap:bug:q-fts-fails-hard-with-q-database-is-locked-when-
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-30 04:14] (created) bug — q fts fails hard with 'q: database is locked' when a second q runs back-to-back or another session holds the store (seen 2026-10-30 in dirt-
- [2026-10-30 04:20] (status) → superseded (by KIT-T487)
- [2026-10-30 04:21] (status) → superseded (by KIT-T487)
