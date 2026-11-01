---
id: KIT-T710
title: hand-write-detect compares only status, mtime and size, so on a filesystem with coarse mtimes a same-size rewrite inside one timestamp tick
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T19:23:16Z
updated: 2026-11-01T23:18:39Z
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

## Notes
Fixed: hooks/lib/shell-snapshot.mjs signature = mtime:size:sha1(content) for source paths up to 1 MiB (the snapshot covers dirty files only). Test hooks/hand-write-detect.test.mjs 41 passed: a same-size rewrite of a dirty file with its mtime restored is caught; a call that leaves the file alone reports nothing. Not changed: attribution of a change to this call when ANOTHER writer changed a file during the call (the snapshot cannot tell writers apart; the checkout-holder registry from KIT-T811 stops the second writer instead).

## History
- [2026-10-29 19:23] (created) bug — hand-write-detect compares only status, mtime and size, so on a filesystem with coarse mtimes a same-size rewrite inside one timestamp tick
- [2026-11-01 23:17] (status) todo → doing
- [2026-11-01 23:18] (status) doing → review
- [2026-11-01 23:18] (landed) 4875b65 hand-write-detect: source files in the snapshot carry a content hash beside mtime and size, so a same-size rewrite insid
