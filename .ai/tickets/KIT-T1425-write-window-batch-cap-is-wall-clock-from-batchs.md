---
id: KIT-T1425
title: write-window batch cap is wall-clock from batchStart: a slow PostToolUse hook (any edit whose hooks take longer than BATCH_MAX_S/EDIT_GAP_S)
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T02:26:11Z
updated: 2026-11-19T02:26:11Z
---

## Description
write-window batch cap is wall-clock from batchStart: a slow PostToolUse hook (any edit whose hooks take longer than BATCH_MAX_S/EDIT_GAP_S) lets the hold lapse mid-batch so another writer's build starts and refuses the rest of the batch (seen in KIT-T1421 with a 120 s lint per edit)

kit-bug-shape: cap:bug:write-window-batch-cap-is-wall-clock-from-batchs:f5057049
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-19 02:26] (created) bug — write-window batch cap is wall-clock from batchStart: a slow PostToolUse hook (any edit whose hooks take longer than BATCH_MAX_S/EDIT_GAP_S)
