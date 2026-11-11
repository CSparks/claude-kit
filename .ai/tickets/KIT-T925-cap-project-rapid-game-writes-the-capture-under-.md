---
id: KIT-T925
title: cap --project rapid-game writes the capture under the stiletto-2349 checkout's rapid-game/.ai/inbox (a submodule checkout's .ai) instead of
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T23:33:51Z
updated: 2026-11-09T23:56:33Z
---

## Description
cap --project rapid-game writes the capture under the stiletto-2349 checkout's rapid-game/.ai/inbox (a submodule checkout's .ai) instead of the rapid-game project store; split out of KIT-T382 when its q show half closed under KIT-T922

kit-bug-shape: cap:bug:cap-project-rapid-game-writes-the-capture-under-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 23:33] (created) bug — cap --project rapid-game writes the capture under the stiletto-2349 checkout's rapid-game/.ai/inbox (a submodule checkout's .ai) instead of
- [2026-11-09 23:33] (comment) seen again in claude-kit: cap --project rapid-game writes the capture under the stiletto-2349 checkout rapid-game/.ai/inbox, a submodule checkout, instead of the rapid-game project store (split from KIT-T382)
- [2026-11-09 23:33] (asked again) 2026-11-09 — cap:bug:cap-project-rapid-game-writes-the-capture-under-
- [2026-11-09 23:56] (comment) @kit-agent: Root cause: projectAiDirs preferred any registered checkout .ai, so rapid-game (registered at the dirt-empire submodule  (full comment #1 in ## Notes)
### comment #1 [2026-11-09 23:56] @kit-agent
Root cause: projectAiDirs preferred any registered checkout .ai, so rapid-game (registered at the dirt-empire submodule checkout, whose .ai holds agent rosters only) resolved there instead of the central store. Fixed: a .ai with config.yml wins, else the central project, else a config-less repo .ai. No misfiled capture exists: the checkout has no inbox, and stiletto-2349/rapid-game/.ai is a link to the central store.
- [2026-11-09 23:56] (status) todo → review
- [2026-11-09 23:56] (landed) 76947ca q code: a dash-led token that is not flag-shaped (a regex, a multi-word pattern) is search text and files no gap, and an
