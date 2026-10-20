---
id: KIT-T584
title: Enforce by hook, not by message: (1) block Bash commands of the form 'python3 -', 'python3 <<', 'python -' heredocs on Windows when python3
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T17:47:19Z
updated: 2026-10-20T00:53:08Z
fixed_commit: b6dd07f
---

## Description
Enforce by hook, not by message: (1) block Bash commands of the form 'python3 -', 'python3 <<', 'python -' heredocs on Windows when python3 resolves to the Microsoft Store stub (it blocks on stdin and leaves background shells that never exit; hung 5 shells and 3 agents for up to 16 hours on 2026-10-19); suggest node -e or a script file; (2) orient/flush should report agents marked running whose last turn ended 'waiting on its own background work' for more than 10 minutes with the shell command, so a hung shell is found in minutes, not hours; (3) the agent dispatch hook should require the [model] prefix in the description (it rewrites it, but resumed agents lose it)

kit-bug-shape: cap:bug:enforce-by-hook-not-by-message-1-block-bash-comm
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 17:47] (created) bug — Enforce by hook, not by message: (1) block Bash commands of the form 'python3 -', 'python3 <<', 'python -' heredocs on Windows when python3
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) (1) done: hooks/python-stdin-gate.mjs blocks stdin python on the Windows Store stub, test hooks/python-stdin-gate.test.mjs 18 passed. (2) and (3) not done: (3) resume-check already warns for an unlabelled row; (2) needs transcript parsing and is filed as follow-up
