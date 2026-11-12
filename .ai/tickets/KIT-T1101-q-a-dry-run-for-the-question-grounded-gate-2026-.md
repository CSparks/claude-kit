---
id: KIT-T1101
title: q: a dry run for the question-grounded gate. 2026-11-12 road-generator: an AskUserQuestion was blocked because the option label 'Stream owns
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T18:16:02Z
updated: 2026-11-12T18:23:10Z
---

## Description
q: a dry run for the question-grounded gate. 2026-11-12 road-generator: an AskUserQuestion was blocked because the option label 'Stream owns its ring' lexically matched RDG-T021 (chunk streaming editor runs the open game's stream config), which the questionnaire had not cited although it carried an [options-checked] tag naming three other items. The orchestrator cannot know which items an option label will match before the call. Wanted: 'q gates question --check <label> [<label>...]' (or q grounded <text>) prints the decisions and open tickets each label matches, using the gate's own matcher, so the citations are written before asking. Root cause of the block: process failure (an uncited match); prevention: this dry run named in the q gates question printout.

kit-bug-shape: cap:feature:q-a-dry-run-for-the-question-grounded-gate-2026-
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
q gates question --check <label> [...] (scripts/q-gates.mjs) prints per label the decisions and open tickets the grounded gate matcher finds (id, kind, title); the matcher is hooks/lib/question-grounding.mjs matchesFor, now shared by groundingMisses and the new groundingMatches (one derivation). q gates question names the command (gate-protocol.mjs GROUNDED_CHECK). Tests: question-grounded-gate 23 passed (match lists fixture decision+ticket, same ids the gate blocks on, no-match prints none, closed ticket absent, no label exits 1, printout names the command), gate-protocol 42 passed. Commit 6510635.

## History
- [2026-11-12 18:16] (created) feature — q: a dry run for the question-grounded gate. 2026-11-12 road-generator: an AskUserQuestion was blocked because the option label 'Stream owns
- [2026-11-12 18:20] (landed) 6510635 q gates question --check <label>...: the grounded gate's own matcher as a dry run, listing per label the decisions and o
- [2026-11-12 18:23] (status) todo → review
