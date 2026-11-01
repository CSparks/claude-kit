---
id: KIT-T710
title: hand-write-detect compares only status, mtime and size, so on a filesystem with coarse mtimes a same-size rewrite inside one timestamp tick
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T19:23:16Z
updated: 2026-11-01T23:17:08Z
---

## Description
hand-write-detect compares only status, mtime and size, so on a filesystem with coarse mtimes a same-size rewrite inside one timestamp tick goes undetected. Fall back to a content hash for dirty files whose mtime and size are unchanged but which were touched within the tick.

kit-bug-shape: cap:bug:hand-write-detect-compares-only-status-mtime-and
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 19:23] (created) bug — hand-write-detect compares only status, mtime and size, so on a filesystem with coarse mtimes a same-size rewrite inside one timestamp tick
- [2026-11-01 23:17] (status) todo → doing
