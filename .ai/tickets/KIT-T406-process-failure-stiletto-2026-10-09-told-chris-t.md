---
id: KIT-T406
title: Process failure (stiletto 2026-10-09): told Chris there was no Steam Deck access when claude-kit scripts/deck-deploy.mjs + ~/.claude/steamde
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T21:31:02Z
updated: 2026-10-09T21:51:58Z
---

## Description
Process failure (stiletto 2026-10-09): told Chris there was no Steam Deck access when claude-kit scripts/deck-deploy.mjs + ~/.claude/steamdeck.json + ~/.ssh/steamdeck (all set up 2026-10-09) existed. Root cause: q fts/code searched only the stiletto repo + rapid-game; kit scripts and machine-level device config (~/.claude/*.json) are invisible from a project session and orientation never lists available devices/deploy targets. Fix: orient lists configured devices (steamdeck.json) and their kit tools; q covers kit scripts from any project.

kit-bug-shape: cap:bug:process-failure-stiletto-2026-10-09-told-chris-t
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 21:31] (created) bug — Process failure (stiletto 2026-10-09): told Chris there was no Steam Deck access when claude-kit scripts/deck-deploy.mjs + ~/.claude/steamde
- [2026-10-09 21:39] (status) todo → doing
- [2026-10-09 21:51] (status) doing → review

## Notes
Fix: scripts/devices.mjs (device registry, steamdeck first) + orient DEVICES / DEPLOY TARGETS block (hooks/orient.mjs, 275 chars, unprotected-by-default in orient-budget so never shortened) shown only when the project is a configured deck game. CLAUDE_KIT_STEAMDECK overrides the config path for tests. Evidence: scripts/devices.test.mjs 6 passed; hooks/orient.test.mjs 28 passed (4 KIT-T406 cases); full npm test chain 86 pass, only server/server.test.mjs fails (express not installed, pre-existing). Code landed early in 596d1fc under KIT-T339.
