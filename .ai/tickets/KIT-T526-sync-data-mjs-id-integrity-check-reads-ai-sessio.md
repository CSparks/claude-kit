---
id: KIT-T526
title: sync-data.mjs id integrity check reads .ai/.session-backups/SESSION-2026-10-15T18-43-44-389Z.md and ...T19-40-03-730Z.md as two items with i
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T19:41:21Z
updated: 2026-10-15T19:49:30Z
---

## Description
sync-data.mjs id integrity check reads .ai/.session-backups/SESSION-2026-10-15T18-43-44-389Z.md and ...T19-40-03-730Z.md as two items with id 'SESSION-2026' and BLOCKS the data commit as a duplicate; the backups the fixed t session writes (KIT-T521, runtime 0211268) are not store items. The id scan must skip .session-backups/ (and any dot-directory), or the backups must live outside the id-scanned tree. Every session on 0211268 that flushes twice hits this --priority high

kit-bug-shape: cap:bug:sync-data-mjs-id-integrity-check-reads-ai-sessio
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 19:41] (created) bug — sync-data.mjs id integrity check reads .ai/.session-backups/SESSION-2026-10-15T18-43-44-389Z.md and ...T19-40-03-730Z.md as two items with i
- [2026-10-15 19:49] (comment) @claude: Fixed in this push. Root cause: storeDirs() in scripts/id-utils.mjs (the one walker behind checkIds, scanStores, nextId, (full comment #1 in ## Notes)
### comment #1 [2026-10-15 19:49] @claude
Fixed in this push. Root cause: storeDirs() in scripts/id-utils.mjs (the one walker behind checkIds, scanStores, nextId, the board and the cache) took every .ai subdirectory, so .ai/.session-backups/SESSION-<ts>.md were read as items. It now skips dot-directories; rekey-ids also skips .session-backups. Backups stay in .ai/.session-backups (self-ignored by git), not moved: one rule covers any future dot-dir. Tests: id-utils 52 passed (two backups: no duplicate, no mismatch, not an item; real-duplicate control still blocks), sync-data 17 passed (two backups: data commit goes through; real duplicate beside them still exits 2); both new cases fail without the fix. t-verbs 13, t 109, rekey-ids 6. Not published.
- [2026-10-15 19:49] (status) todo → review
