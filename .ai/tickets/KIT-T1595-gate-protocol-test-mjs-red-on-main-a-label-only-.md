---
id: KIT-T1595
title: gate-protocol.test.mjs red on main: 'a label-only problem is the dispatch-label hook's block, not the guard's' fails (64 passed, 1 failed),
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:13:07Z
updated: 2026-11-26T01:19:22Z
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
Root cause: gate-protocol.test.mjs called dispatch-guard through the plain hook() harness, which reads the live kit capability table; that table (evidence and lineup 2026-11-18, refresh period 7 days) went stale and capability-table-stale blocked the label-only case. dispatch-guard-harness.mjs already pins CLAUDE_KIT_LADDER_ROOT to a fresh fixture; gate-protocol now passes the same fresh fixture (test-harness fixtureKit(isoDaysAgo(0))) to both guard calls. gate-protocol 65 passed 0 failed (target/t1595-after.txt). The live table is still stale: real dispatches in every session hit that block until the model refresh runs.

## History
- [2026-11-26 01:13] (created) bug — gate-protocol.test.mjs red on main: 'a label-only problem is the dispatch-label hook's block, not the guard's' fails (64 passed, 1 failed),
- [2026-11-26 01:19] (status) todo → review
