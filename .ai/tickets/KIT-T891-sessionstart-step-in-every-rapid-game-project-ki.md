---
id: KIT-T891
title: SessionStart step in every rapid-game project (KIT-D141): fetch rapid-game origin/main, pin it (broker pin flow where a broker owns the tree
type: feature
status: todo
priority: high
asked: 2
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T16:29:43Z
updated: 2026-11-08T16:29:43Z
---

## Description
SessionStart step in every rapid-game project (KIT-D141): fetch rapid-game origin/main, pin it (broker pin flow where a broker owns the tree), report the delta and any conflict; extends KIT-T870 (flag only) and KIT-T381 (drift report); enforces KIT-D133/KIT-D141

kit-bug-shape: cap:feature:sessionstart-step-in-every-rapid-game-project-ki
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-08 16:29] (created) feature — SessionStart step in every rapid-game project (KIT-D141): fetch rapid-game origin/main, pin it (broker pin flow where a broker owns the tree
- [2026-11-08 16:29] (comment) seen again in claude-kit: SessionStart step in every rapid-game project (KIT-D141): fetch rapid-game origin/main, pin it (broker pin flow where a broker owns the tree), report the delta and any conflict; extends KIT-T870 (flag only) and KIT-T381 (drift report); enforces KIT-D133/KIT-D141
- [2026-11-08 16:29] (asked again) 2026-11-08 — cap:feature:sessionstart-step-in-every-rapid-game-project-ki
- [2026-11-10 19:21] (comment) @claude: Not started: a SessionStart hook that fetches, pins (a commit in the game repo; through the broker pin flow where a brok (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:21] @claude
Not started: a SessionStart hook that fetches, pins (a commit in the game repo; through the broker pin flow where a broker owns the tree) and resolves conflicts in five game projects is a design decision, not a targeted fix: what a failed fetch or a conflict does at SessionStart, who commits the pin, behaviour when the broker daemon is mid-job. Recommend a plan job (opus) first; the read-only half (fetch and report the delta, extending KIT-T870/T381) could land alone.
- [2026-11-11 03:24] (landed) c1f17e5 framework-pin: report-only SessionStart step for a consumer of a framework submodule: bounded throttled fetch of origin/
- [2026-11-11 03:25] (landed) 66c900f rapid-game contract states the session-start pin rule (pull and pin at start, no ticket, a break is priority one through
- [2026-11-11 03:30] (landed) ab62621 pin-scope: changedCrates reads every Cargo.toml of a ref with one batched cat-file (showFiles) instead of one process pe
- [2026-11-11 03:31] (landed) 38340f7 pin-scope: submoduleCrates takes the batched manifest read (implements KIT-T891)
- [2026-11-11 03:33] (landed) fac94d6 pin-scope: drop the unused showFile import (implements KIT-T891)
