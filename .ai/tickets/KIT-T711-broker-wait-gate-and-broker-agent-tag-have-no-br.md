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

## History
- [2026-10-29 19:23] (created) bug — broker-wait-gate and broker-agent-tag have no branch for ambiguous quoting (KIT-T705 contract): a command hidden behind an escaped quote is
- [2026-11-01 19:41] (status) todo → review
