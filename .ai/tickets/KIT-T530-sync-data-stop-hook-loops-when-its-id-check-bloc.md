---
id: KIT-T530
title: sync-data Stop hook loops: when its id check blocks and nothing in .ai changed since the last block (same finding, same files), it still ret
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T20:38:48Z
updated: 2026-10-15T20:38:48Z
---

## Description
sync-data Stop hook loops: when its id check blocks and nothing in .ai changed since the last block (same finding, same files), it still returns a blocking Stop result, so the session is re-prompted every turn with no way for the agent to clear it (dirt-empire 2026-10-15, 5 consecutive re-prompts on the KIT-T526 false positive while the fix awaited publish; moving the backup was denied by the classifier). Fix: a repeated identical block reports once, then downgrades to a non-blocking warning until the finding changes; test: two consecutive Stops with the same finding block once.

kit-bug-shape: cap:bug:sync-data-stop-hook-loops-when-its-id-check-bloc
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-15 20:38] (created) bug — sync-data Stop hook loops: when its id check blocks and nothing in .ai changed since the last block (same finding, same files), it still ret
