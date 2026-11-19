---
id: KIT-T1425
title: write-window batch cap is wall-clock from batchStart: a slow PostToolUse hook (any edit whose hooks take longer than BATCH_MAX_S/EDIT_GAP_S)
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-19T02:26:11Z
updated: 2026-11-19T02:43:10Z
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

## Notes
Fix: the batch hold now counts write-idle time, not wall clock. scripts/broker/write-window.mjs: a passing edit accrues the gap since the last landing into the window's idleMs and holds the writer's windows IN_FLIGHT_S (now 2 x LONG_LIMIT_MS = 240 s, one edit's PreToolUse plus PostToolUse hook limits) while BATCH_IDLE_S (120 s) of idle is unspent; a landing gives EDIT_GAP_S (30 s); nothing holds past BATCH_CEILING_S (600 s) from the first edit; START_WAIT_S = ceiling + gap (630 s). A failed Edit/Write (PostToolUseFailure, wired to tool-write-record.mjs) ends its in-flight hold like a landing, so a "String to replace not found" edit no longer holds 240 s (reaches a session after restart). builds --wait's promise text names the idle budget and the ceiling.

Tests: scripts/broker/write-window.test.mjs 12 passed (new: four edits of 120 s hooks each keep the hold to the last landing, control lapses one gap later; idle budget spent stops extension; ceiling holds however busy; IN_FLIGHT_S = 2 x LONG_LIMIT_MS; the free-wait text assertion that had failed since KIT-T1404 fixed). hooks/build-write-hold.test.mjs all PASS (new: a failed edit ends the in-flight hold at the edit gap). build-wait 7, build-status 3, gate-wiring 17, plugin-compat 164, runtime-wiring 22, hand-write-detect 73, tool-writes-race 8 passed.

## History
- [2026-11-19 02:26] (created) bug — write-window batch cap is wall-clock from batchStart: a slow PostToolUse hook (any edit whose hooks take longer than BATCH_MAX_S/EDIT_GAP_S)
- [2026-11-19 02:43] (status) todo → review
