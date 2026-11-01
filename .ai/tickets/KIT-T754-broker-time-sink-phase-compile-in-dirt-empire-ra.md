---
id: KIT-T754
title: broker time sink: phase compile in dirt-empire/rapid-game
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: [KIT-D121]
files: []
supersedes:
superseded_by:
created: 2026-10-31T01:24:53Z
updated: 2026-11-01T22:36:29Z
---

## Description
phase compile in dirt-empire/rapid-game: 128.0 min, 40% of its phase time, 2.2 min/job, worse (+68% per job), #2 (was #6)

kit-bug-shape: broker-blocker:dirt-empire|rapid-game|phase|compile
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-31 01:24] (created) bug — broker time sink: phase compile in dirt-empire/rapid-game
- [2026-10-31 02:24] (comment) seen again in dirt-empire: phase compile in dirt-empire/rapid-game: 144.7 min, 41% of its phase time, 2.5 min/job, worse (+77% per job), #2 (was #6)
- [2026-10-31 16:16] (comment) seen again in dirt-empire: phase compile in dirt-empire/rapid-game: 107.0 min, 46% of its phase time, 4.0 min/job, worse (+202% per job), #2 (was #6)
- [2026-10-31 16:19] (comment) seen again in dirt-empire: phase compile in dirt-empire/rapid-game: 107.0 min, 47% of its phase time, 4.1 min/job, worse (+219% per job), #2 (was #6)
- [2026-10-31 17:19] (comment) seen again in dirt-empire: phase compile in dirt-empire/rapid-game: 109.2 min, 44% of its phase time, 3.8 min/job, worse (+209% per job), #1 (was #7)
- [2026-10-31 18:18] (comment) seen again in dirt-empire: phase compile in dirt-empire/rapid-game: 103.9 min, 44% of its phase time, 4.0 min/job, worse (+217% per job), #1 (was #6)
- [2026-11-01 15:37] (comment) update in dirt-empire: no longer a top blocker (was #1): improved, corrected or gone quiet
- [2026-11-01 15:37] (comment) update in dirt-empire: no longer a top blocker (was #1): improved, corrected or gone quiet
- [2026-11-01 22:36] (status) todo → superseded
- [2026-11-01 22:36] (comment) @kit-agent: Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical  (full comment #1 in ## Notes)
### comment #1 [2026-11-01 22:36] @kit-agent
Superseded 2026-11-01: not material in dirt-empire/rapid-game now (per-job cost under a twentieth of the lane's typical job). The broker tick lists material sinks in one rolling ticket per lane and opens 'time sinks: dirt-empire/rapid-game' when one appears.
