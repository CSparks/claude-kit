---
id: KIT-T1023
title: process failure: two retired agents (marblequest 2026-11-10, implementer and game-asset-artist) wrote their Handoff blocks under a lane name
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T05:44:40Z
updated: 2026-11-11T05:44:40Z
---

## Description
process failure: two retired agents (marblequest 2026-11-10, implementer and game-asset-artist) wrote their Handoff blocks under a lane name, not 'Handoff <agent id>', so handoff-before-replace blocked the successor dispatch and both 300k+ agents had to be resumed. Root cause: the orchestrator brief said 'Handoff <your id>' and an agent cannot see its own id; prevention: the dispatch hook injects the agent id into the brief (or the gate accepts a Handoff block written by that agent under any heading, matched by the roster row).

kit-bug-shape: cap:bug:process-failure-two-retired-agents-marblequest-2
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 05:44] (created) bug — process failure: two retired agents (marblequest 2026-11-10, implementer and game-asset-artist) wrote their Handoff blocks under a lane name
