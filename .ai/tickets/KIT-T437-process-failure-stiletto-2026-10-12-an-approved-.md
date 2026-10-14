---
id: KIT-T437
title: Process failure (stiletto, 2026-10-12): an approved multi-stage programme stalled 5 days — ST-D224 (2026-10-07) approved shader wear S4 and
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T02:31:43Z
updated: 2026-10-13T02:31:43Z
---

## Description
Process failure (stiletto, 2026-10-12): an approved multi-stage programme stalled 5 days — ST-D224 (2026-10-07) approved shader wear S4 and texture arrays S3 after the unit merge; S2 landed 2026-10-07 20:12 and nothing pulled S4 since. Root cause: the approved stages had no milestone, so the drain had nothing to order them by, and the writer slot went to interjections (Deck, deposits, mine entrance) that STEERED instead of being captured. Chris 2026-10-12: 'How the fuck was none of this done already?' Fix: an approving decision that names stages creates/schedules the stage tickets onto the current milestone (decide.mjs + index-tickets), and orient flags an approved stage with no ticket in doing/todo-on-milestone under DISPATCH NOW.

kit-bug-shape: cap:bug:process-failure-stiletto-2026-10-12-an-approved-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 02:31] (created) bug — Process failure (stiletto, 2026-10-12): an approved multi-stage programme stalled 5 days — ST-D224 (2026-10-07) approved shader wear S4 and
- [2026-10-13 02:36] (comment) seen again in stiletto-2349: Process failure (stiletto, 2026-10-12): an approved multi-stage programme stalled 5 days. ST-D224 (2026-10-07) approved shader wear S4 and texture arrays S3 after the unit merge; S2 landed 2026-10-07 20:12 and nothing pulled S4 since. Root cause: the approved stages had no milestone so the drain had
- [2026-10-13 02:36] (asked again) 2026-10-13 — cap:bug:process-failure-stiletto-2026-10-12-an-approved-
