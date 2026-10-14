---
id: KIT-T439
title: Process failure (stiletto-2349-68, 2026-10-12): offered Chris 'sleep/wake spec' as a programme lane although RG-T117 was built (10/11 criter
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T02:40:43Z
updated: 2026-10-13T02:40:43Z
---

## Description
Process failure (stiletto-2349-68, 2026-10-12): offered Chris 'sleep/wake spec' as a programme lane although RG-T117 was built (10/11 criteria ticked) and Chris had ruled its open questions on 2026-10-02 (RG-T117 #8). Root cause: a 'HELD for design ... Next: revised spec, then resume writer' line in the rapid-game SESSION.md NOW section was never cleared after the ruling landed eight minutes later, and orient replays NOW lines without checking the referenced ticket. Fix: orient flags a HELD/NEXT anchor line whose ticket has a later status change or >80% criteria ticked as STALE, and the ticket's own trail (q trail) is cited before any 'needs design' claim.

kit-bug-shape: cap:bug:process-failure-stiletto-2349-68-2026-10-12-offe
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 02:40] (created) bug — Process failure (stiletto-2349-68, 2026-10-12): offered Chris 'sleep/wake spec' as a programme lane although RG-T117 was built (10/11 criter
