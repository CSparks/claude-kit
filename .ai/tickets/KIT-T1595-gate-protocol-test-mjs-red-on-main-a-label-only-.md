---
id: KIT-T1595
title: gate-protocol.test.mjs red on main: 'a label-only problem is the dispatch-label hook's block, not the guard's' fails (64 passed, 1 failed),
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:13:07Z
updated: 2026-11-26T01:13:07Z
---

## Description
gate-protocol.test.mjs red on main: 'a label-only problem is the dispatch-label hook's block, not the guard's' fails (64 passed, 1 failed), reproduced at HEAD 6f21f8e-era kit main with no local hook edits; root cause not diagnosed (seen while landing KIT-T1594)

kit-bug-shape: cap:bug:gate-protocol-test-mjs-red-on-main-a-label-only-:e39a24c6
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Correction: the Description's '6f21f8e' is a fleet-desktop commit, not a kit one. The failure reproduces on kit main c63b94d1 with hooks/lib/question-ready.mjs and hooks/question-brief-gate.test.mjs stashed (no local hook edits). Output: target/t1594-protocol-base.txt in the kit checkout.

## History
- [2026-11-26 01:13] (created) bug — gate-protocol.test.mjs red on main: 'a label-only problem is the dispatch-label hook's block, not the guard's' fails (64 passed, 1 failed),
