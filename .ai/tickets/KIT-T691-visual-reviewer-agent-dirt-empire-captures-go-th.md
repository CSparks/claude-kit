---
id: KIT-T691
title: visual-reviewer agent: dirt-empire captures go through the console now, not --capture. Replace agents/visual-reviewer.md line 24 with: run t
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes: KIT-T692
superseded_by:
created: 2026-10-29T00:26:52Z
updated: 2026-10-29T00:26:52Z
---

## Description
visual-reviewer agent: dirt-empire captures go through the console now, not --capture. Replace agents/visual-reviewer.md line 24 with: run the game with RG_CONSOLE_EXEC="exec capture-<view>" (scripts in crates/dirt-empire/assets/console: capture-title, -race, -night, -truck, -front, -side, -garage, -mx-practice) or an inline line like RG_CONSOLE_EXEC="snd_enable 0; showroom side; capture .local/side.png". The game binary takes no switches since DE-T207 (30a2df3).

kit-bug-shape: cap:feature:visual-reviewer-agent-dirt-empire-captures-go-th
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 00:26] (created) feature — visual-reviewer agent: dirt-empire captures go through the console now, not --capture. Replace agents/visual-reviewer.md line 24 with: run t
