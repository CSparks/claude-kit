---
id: KIT-T668
title: PROCESS FAILURE 2026-10-28 (rapid-game overnight fan-out): orchestrator proposed rg-items and rg-abilities as gaps, but origin/main already
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T06:18:54Z
updated: 2026-10-28T06:18:54Z
---

## Description
PROCESS FAILURE 2026-10-28 (rapid-game overnight fan-out): orchestrator proposed rg-items and rg-abilities as gaps, but origin/main already had rg-inventory (MAR-T012) and rg-stats (MAR-T010). Root cause: the machine registry maps project rapid-game to D:/dev/stiletto-2349/rapid-game, a consumer's SUBMODULE checkout on a detached HEAD 12 commits behind origin/main; both the crate survey (ls) and every q 'no results' existence check ran against that stale tree. q/orient give no staleness signal. Fix direction: q (and orient) should warn when the indexed checkout is behind its upstream, and the registry should name a framework checkout that tracks main (or q should index origin/main's tree).

kit-bug-shape: cap:bug:process-failure-2026-10-28-rapid-game-overnight-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 06:18] (created) bug — PROCESS FAILURE 2026-10-28 (rapid-game overnight fan-out): orchestrator proposed rg-items and rg-abilities as gaps, but origin/main already
