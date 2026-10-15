---
id: KIT-T507
title: Process failure: Chris had to repeat a standing directive (2026-10-15: 'I'VE FUCKIGN SAID THIS BEFORE. WHY THE FUCK DO I HAVE TO REPEAT MYSELF ALL THE FUCKING TIME?') - the broker brokers writes per repo, kit never blocks or is blocked. q finds no earlier record in kit, stiletto or dirt-empire stores, so the first statement was never captured as a decision. Root causes: (1) directives spoken in one session are not captured to DECISIONS that turn and never reach other sessions; (2) decision files cannot be written from stiletto-2349-2a: the auto-mode classifier skipped Write on .ai/decisions/KIT-D095 and KIT-D096 (2026-10-14/15), so both rulings live only in ticket comments that orient does not replay; (3) the broker design (KIT-T270/T276) keys the queue on the checkout, not the repo, and nothing checks a design against recorded directives
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T14:49:27Z
updated: 2026-10-15T14:49:27Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T482, KIT-T439, KIT-T444

## History
- [2026-10-15 14:49] (created) bug — Process failure: Chris had to repeat a standing directive (2026-10-15: 'I'VE FUCKIGN SAID THIS BEFORE. WHY THE FUCK DO I HAVE TO REPEAT MYSELF ALL THE FUCKING TIME?') - the broker brokers writes per repo, kit never blocks or is blocked. q finds no earlier record in kit, stiletto or dirt-empire stores, so the first statement was never captured as a decision. Root causes: (1) directives spoken in one session are not captured to DECISIONS that turn and never reach other sessions; (2) decision files cannot be written from stiletto-2349-2a: the auto-mode classifier skipped Write on .ai/decisions/KIT-D095 and KIT-D096 (2026-10-14/15), so both rulings live only in ticket comments that orient does not replay; (3) the broker design (KIT-T270/T276) keys the queue on the checkout, not the repo, and nothing checks a design against recorded directives
