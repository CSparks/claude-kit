---
id: KIT-T921
title: Process failure 2026-11-09 (groovegrid): asked 'what are we leaving on the table from Cirklon and NDLR', the orchestrator answered from memo
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T23:19:04Z
updated: 2026-11-09T23:19:04Z
---

## Description
Process failure 2026-11-09 (groovegrid): asked 'what are we leaving on the table from Cirklon and NDLR', the orchestrator answered from memory and listed 'a harmonic spine' as an NDLR idea although GrooveGrid already has it (scene key/scale/chord spans, chord lane, fire-time chord-span resolution GG-T079, GG-T100). ROOT CAUSE: a gap-analysis question was answered by recalling the other products first; the orchestrator searched only for the competitor names (q fts cirklon ndlr) and never for GG's own feature nouns (chord, key, scale, progression, role) before listing gaps. PREVENTION: before any 'what are we missing / compare to X' answer, query the own product's feature nouns with q and list each candidate as 'we have it (pointer)' or 'gap'; put the same line in the researcher/analyst brief template. Chris: 'Ours has the harmonic spine. If you missed it, that's a problem.'

kit-bug-shape: cap:bug:process-failure-2026-11-09-groovegrid-asked-what
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 23:19] (created) bug — Process failure 2026-11-09 (groovegrid): asked 'what are we leaving on the table from Cirklon and NDLR', the orchestrator answered from memo
- [2026-11-09 23:20] (comment) @claude: Recurrence in the same answer (Chris 2026-11-09): the list also implied bar-level chord changes and polymeter as gaps; G (full comment #1 in ## Notes)
### comment #1 [2026-11-09 23:20] @claude
Recurrence in the same answer (Chris 2026-11-09): the list also implied bar-level chord changes and polymeter as gaps; GG has sub-bar chord changes on purpose and a per-track time division, and strum mode already carries inversion and spread. Same root cause: gap list written from memory before querying our own features.
