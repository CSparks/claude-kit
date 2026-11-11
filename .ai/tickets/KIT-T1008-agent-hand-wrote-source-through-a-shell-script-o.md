---
id: KIT-T1008
title: agent hand-wrote source through a shell script or sed -i three times in one session (source-shell-write blocks), and set a Bash timeout over
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:04:12Z
updated: 2026-11-11T04:04:12Z
---

## Description
agent hand-wrote source through a shell script or sed -i three times in one session (source-shell-write blocks), and set a Bash timeout over 5 minutes once; root cause: edits reached for the shell when an Edit was blocked or inconvenient; prevention: the gate already blocks, the brief template for fix agents should state Edit-only for source and the 300000 ms cap

kit-bug-shape: cap:bug:agent-hand-wrote-source-through-a-shell-script-o
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 04:04] (created) bug — agent hand-wrote source through a shell script or sed -i three times in one session (source-shell-write blocks), and set a Bash timeout over
