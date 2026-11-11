---
id: KIT-T936
title: Process failure 2026-11-09 dirt-empire: the orchestrator offered 'share flora meshes across cells' as a fresh questionnaire option without c
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T16:26:11Z
updated: 2026-11-10T18:08:32Z
---

## Description
Process failure 2026-11-09 dirt-empire: the orchestrator offered 'share flora meshes across cells' as a fresh questionnaire option without citing DE-D077 (2026-11-02: foliage/rocks are framework crates shared with Stiletto) or its unbuilt ticket DE-T285; Chris: 'Absolutely shared meshes across cells was discussed ... It should've been already. If this doesn't answer the question, it wasn't explained very well.' Root cause: the question-brief gate checks the brief's shape (Decision/Evidence/options) but not that its options were grounded against the decision store; a worker's option list was relayed without a q fts on the option's nouns. Proposed enforcement: the question-brief gate runs q fts over each option label's nouns and blocks when a matching decision or open ticket is not cited in Evidence.

kit-bug-shape: cap:bug:process-failure-2026-11-09-dirt-empire-the-orche
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 48f36f4; tests: hooks/question-grounded-gate.test.mjs (negative controls included); standing kit agent adcd3ffd
Real-store measure (no tuning): replaying the groovegrid SHIFT/GATE and shared SHORT questionnaires against real stores with no citations gives misses per set SHORT/SHIFT/GATE: kit 3/6/11, dirt-empire 3/4/3, groovegrid 3/6/3, stiletto 3/11/2; store load 100-973 ms. Against its own store the groovegrid SHIFT questionnaire flags 6 items, 2 clearly relevant (GG-D051, GG-T194 Shift+click range select) and 4 noise (GG-T189, GG-T049, GG-T180, GG-T169). So real accepted questionnaires would block until cited; the options-checked escape clears. Thresholds: words of 4+ letters, 2 shared stems with 1 in the title, best 3 per option.

## History
- [2026-11-10 16:26] (created) bug — Process failure 2026-11-09 dirt-empire: the orchestrator offered 'share flora meshes across cells' as a fresh questionnaire option without c
- [2026-11-10 17:42] (landed) 48f36f4 question-grounded gate: an option that matches a recorded decision or open ticket (label stems against titles and bodies
- [2026-11-10 18:08] (status) todo → review
- [2026-11-10 18:21] (landed) 1548452 tickets: KIT-T906, T936, T937, T943, T944, T955 in review with landing notes, KIT-T948 reopened for the partial-commit c
- [2026-11-10 18:21] (landed) eb9eb7f plugin 0.1.39: sessions pick up the question-grounded gate registration in hooks.json (implements KIT-T936)
