---
id: KIT-T617
title: Decisions are recorded but never enforced: RG-D028 (2026-08-19) made Avian the framework's conventional physics lane, yet Dirt Empire (first
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-21T17:48:33Z
updated: 2026-10-21T17:48:33Z
---

## Description
Decisions are recorded but never enforced: RG-D028 (2026-08-19) made Avian the framework's conventional physics lane, yet Dirt Empire (first commit cdda23d 2026-10-03) shipped on the Rapier-only streaming world from day one, and every vehicle mechanic since landed Rapier-only (streaming/drive.rs:119-125). Three gaps let it through: (1) RG-Q005 sat open since 2026-08-29 calling the lane 'ruled both ways', so a lookup returned ambiguity, not the rule; (2) rg-physics's open-world collider streaming exists only on Rapier, so the code steers any streaming game off the convention; (3) no gate checks a game's or crate's dependency choices against docs/CHOICES.toml defaults (concern-check covers 'framework owns this', not 'convention says X'). Chris 2026-10-21: 'What fucking good is it to have a record of decisions and work if it's never fucking referenced?' Fix: a convention gate at dependency/feature time (Cargo.toml edits, new-poc, dispatch briefs touching a CHOICES concern) that blocks a non-default choice without a recorded exception; orient lists each repo's current deviations; an open question contradicting a decided row is surfaced as a blocker, not left open.

kit-bug-shape: cap:bug:decisions-are-recorded-but-never-enforced-rg-d02
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-21 17:48] (created) bug — Decisions are recorded but never enforced: RG-D028 (2026-08-19) made Avian the framework's conventional physics lane, yet Dirt Empire (first
