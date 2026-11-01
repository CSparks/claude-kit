---
id: KIT-T711
title: broker-wait-gate and broker-agent-tag have no branch for ambiguous quoting (KIT-T705 contract): a command hidden behind an escaped quote is
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T19:23:18Z
updated: 2026-11-01T19:41:15Z
---

## Description
broker-wait-gate and broker-agent-tag have no branch for ambiguous quoting (KIT-T705 contract): a command hidden behind an escaped quote is not seen. They use hooks/lib/broker-calls.mjs, which is untracked and owned by another session. Once that file is committed, add the raw trigger-word block and a hidden-command regression test (hooks/hidden-command-cases.mjs).

kit-bug-shape: cap:bug:broker-wait-gate-and-broker-agent-tag-have-no-br
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Done: broker-calls.mjs is committed and reads an ambiguous line word by word; added the hidden-command regression (hooks/hidden-command-cases.mjs) to hooks/broker-wait-gate.test.mjs: a watch behind an escaped quote and behind a dollar-quote string blocks, a hidden wait loop blocks, an unrelated hidden command passes, broker-agent-tag tags a hidden submit. 68 passed.
Verified by the standing kit agent 2026-11-01: the implementing commit is d85eb23 on main (the same tree first pushed as 91541d9, mis-titled 'implements MAR-T035' because the marblequest-18 agent reused a scratchpad message file; the real MAR-T035 fix is marblequest 22a34d6). Re-ran broker-wait-gate 70, shell-segments 31, query-gate all pass, store-shell-gate 40, source-shell-gate 130, hand-write-detect 39, wait-poll 28, broker-log-gate 19, branch-guard 46, python-stdin-gate 53, tree-delete-gate 27, upstream-gate 38: 0 failed. Status review stands on that test evidence.

## History
- [2026-10-29 19:23] (created) bug — broker-wait-gate and broker-agent-tag have no branch for ambiguous quoting (KIT-T705 contract): a command hidden behind an escaped quote is
- [2026-11-01 19:41] (status) todo → review
- [2026-11-01 19:45] (landed) d85eb23 gates: quoted heredoc bodies and quoted arguments are inert data; read-only loops pass the wait gates (implements KIT-T7
