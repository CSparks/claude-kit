---
id: KIT-T435
title: Kit specialist agents (game-asset-artist and others with scoped tools:) have no SendMessage, so they can't send milestone pings to the orche
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T21:11:19Z
updated: 2026-10-12T21:11:19Z
---

## Description
Kit specialist agents (game-asset-artist and others with scoped tools:) have no SendMessage, so they can't send milestone pings to the orchestrator. A long build ran silent for an hour (Chris: 'zero feedback'), then the agent handed back early just to report (dirt-empire DE-T131, 2026-10-12). Add SendMessage to every writer specialist's tools: line, and teach the agent bodies the milestone-ping convention.

kit-bug-shape: cap:bug:kit-specialist-agents-game-asset-artist-and-othe
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-12 21:11] (created) bug — Kit specialist agents (game-asset-artist and others with scoped tools:) have no SendMessage, so they can't send milestone pings to the orche
