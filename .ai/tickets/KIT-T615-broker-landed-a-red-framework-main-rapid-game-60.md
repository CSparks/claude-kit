---
id: KIT-T615
title: Broker landed a red framework main: rapid-game 60fb8fc4 (DE-T153, rg-ui rows.rs cursor change) passed its gate on 'the job's own commands, f
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T16:28:40Z
updated: 2026-10-21T16:28:40Z
---

## Description
Broker landed a red framework main: rapid-game 60fb8fc4 (DE-T153, rg-ui rows.rs cursor change) passed its gate on 'the job's own commands, full suite on the cadence' (2/2 green, rg-ui only), but broke 6 tests in the dependent crate rg-screens (game_seams x2, journey, lifecycle, screens delete-save, golden). Every later rapid-game land is now refused at the pre-push gate (RG-T280 parked 2026-10-21, vehicle twin landings blocked; fix in flight as RG-T285). Root cause: the per-job gate tests only the commands the submitter names; it does not add the reverse dependents of the changed crates, and the cadence full suite runs after the push. Fix: the land gate adds every workspace crate that depends on a changed crate (cargo metadata reverse deps) before it pushes.

kit-bug-shape: cap:bug:broker-landed-a-red-framework-main-rapid-game-60
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-21 16:28] (created) bug — Broker landed a red framework main: rapid-game 60fb8fc4 (DE-T153, rg-ui rows.rs cursor change) passed its gate on 'the job's own commands, f
