---
id: KIT-T861
title: successor-gate loops with no exit: it blocked every reply 20+ times demanding a successor worker for tickets whose next step waits on a queu
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-05T22:46:08Z
updated: 2026-11-05T22:46:08Z
---

## Description
successor-gate loops with no exit: it blocked every reply 20+ times demanding a successor worker for tickets whose next step waits on a queued broker job (DE-T298 measure j-mw43owtb-yts18y) or a known kit bug (KIT-T853 land timeout), while the maintainer was asking direct questions. Each dispatch only produced another handoff-and-stop worker, which re-armed the gate (4 successors for DE-T298 in a row, each writes a handoff and stops). Needs: a gate state for 'waiting on queued job / blocked on kit bug' that is not a block; never block a turn that answers a maintainer question; cap on repeats then surface to the maintainer instead of demanding more spawns. Dirt-empire session 2026-11-05.

kit-bug-shape: cap:bug:successor-gate-loops-with-no-exit-it-blocked-eve
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
KIT-D132 (2026-11-05): successor-gate and handback-directive no longer block or order a dispatch: they print one OPEN notice per distinct set per session and exit 0 (hooks/successor-gate.test.mjs 18, handback.test.mjs 36, handoff-close 10, reopened 8, dispatch-worker 30 passed). The loop is gone with the block.

## History
- [2026-11-05 22:46] (created) bug — successor-gate loops with no exit: it blocked every reply 20+ times demanding a successor worker for tickets whose next step waits on a queu
- [2026-11-05 23:23] (landed) 6de33d2 KIT-D132: hooks never dispatch or block; bill of work stated in every orient (implements KIT-D132, KIT-T861)
