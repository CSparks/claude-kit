---
id: KIT-T634
title: Orphaned tree-wide grep escaped query-gate: session 27188 ran 'grep -rln -E start-server\.cmd|llm[\/]run\.ps1 /d/dev/claude-kit/scripts /d/l
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-23T18:38:17Z
updated: 2026-10-23T18:38:17Z
---

## Description
Orphaned tree-wide grep escaped query-gate: session 27188 ran 'grep -rln -E start-server\.cmd|llm[\/]run\.ps1 /d/dev/claude-kit/scripts /d/llm' via Git-Bash at 13:31; its shell exited but grep kept running 5+ min, pinning D: HDD at 99% and causing input lag in every claude session (kit loads via --plugin-dir D:\dev\claude-kit). Root causes: (1) query-gate misses grep -r on the Bash tool; (2) timed-out/backgrounded shell leaves child grep orphaned; (3) q has no coverage of D:\llm (q code --path D:/dev/claude-kit returned 'no indexed file'). 2026-10-23

kit-bug-shape: cap:bug:orphaned-tree-wide-grep-escaped-query-gate-sessi
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-23 18:38] (created) bug — Orphaned tree-wide grep escaped query-gate: session 27188 ran 'grep -rln -E start-server\.cmd|llm[\/]run\.ps1 /d/dev/claude-kit/scripts /d/l
