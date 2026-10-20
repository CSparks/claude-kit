---
id: KIT-T529
title: sync-data id integrity check false positive on .ai/.session-backups: every 't session --append' writes .ai/.session-backups/SESSION-<iso>.md
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T20:35:52Z
updated: 2026-10-15T20:35:52Z
---

## Description
sync-data id integrity check false positive on .ai/.session-backups: every 't session --append' writes .ai/.session-backups/SESSION-<iso>.md and sync-data parses each as id 'SESSION-2026', so the second backup of a day blocks the Stop-time data commit ('DUPLICATE SESSION-2026: .session-backups/SESSION-2026-10-15T20-28-22-643Z.md · ...20-35-29-505Z.md') and tells the agent to re-key a backup. q also indexes them as items (q fts shows DE-.SESSION-BACKUPS-SESSION-...). Fix: the id-integrity scan and the q indexer skip .session-backups (or the backups move out of .ai/); test: two same-day backups pass the check and are absent from q fts.

kit-bug-shape: cap:bug:sync-data-id-integrity-check-false-positive-on-a
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 20:35] (created) bug — sync-data id integrity check false positive on .ai/.session-backups: every 't session --append' writes .ai/.session-backups/SESSION-<iso>.md
- [2026-10-15 20:36] (comment) @claude: Duplicate of KIT-T526, fixed in e41ecc4 but not yet published; the block persists until the runtime publishes. Close as a duplicate.
