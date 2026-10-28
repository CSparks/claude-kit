---
id: KIT-T673
title: screenshot-reviewer agent (DE-D057, Chris 2026-10-28): a kit agent that captures a game at set views (the game's own --capture path, Deck vi
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T18:34:49Z
updated: 2026-10-28T18:57:03Z
---

## Description
screenshot-reviewer agent (DE-D057, Chris 2026-10-28): a kit agent that captures a game at set views (the game's own --capture path, Deck via deck-deploy) and writes a visual quality critique (art, composition, polish, breakage) with fixes; findings become tickets; numeric checks stay the gate. Amend the global base rule 'Visual output is NOT evidence' to: screenshots allowed for critique by this reviewer, never as pass/fail proof.

kit-bug-shape: cap:feature:screenshot-reviewer-agent-de-d057-chris-2026-10-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 4bf9692. Tests: hooks/dispatch-guard.test.mjs (greenfield on opus passes without escalate/override; sonnet blocked; fix on opus still blocked), scripts/agent-pins.test.mjs 18 passed, scripts/plugin-compat.test.mjs 123 passed, job-capability 24 passed, dispatch-ladder 24 passed. Decisions KIT-D108 (greenfield), KIT-D109 (screenshot rule).

## History
- [2026-10-28 18:34] (created) feature — screenshot-reviewer agent (DE-D057, Chris 2026-10-28): a kit agent that captures a game at set views (the game's own --capture path, Deck vi
- [2026-10-28 18:57] (status) todo → review
