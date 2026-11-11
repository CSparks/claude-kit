---
id: KIT-T1028
title: Process failure RDG-T004 2026-11-11: a subagent set a Bash timeout of 600000 ms (broker-wait gate blocked it) and hand-edited a .ai ticket f
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T06:29:54Z
updated: 2026-11-11T06:29:54Z
---

## Description
Process failure RDG-T004 2026-11-11: a subagent set a Bash timeout of 600000 ms (broker-wait gate blocked it) and hand-edited a .ai ticket file (store-write gate blocked it); root cause is dispatch briefs do not quote the 280000 ms ceiling or 't criterion/t notes' as the only ticket writers; prevention: put both in the standing writer-agent brief template

kit-bug-shape: cap:bug:process-failure-rdg-t004-2026-11-11-a-subagent-s
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 06:29] (created) bug — Process failure RDG-T004 2026-11-11: a subagent set a Bash timeout of 600000 ms (broker-wait gate blocked it) and hand-edited a .ai ticket f
