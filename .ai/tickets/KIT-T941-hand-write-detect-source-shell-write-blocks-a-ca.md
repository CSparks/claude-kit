---
id: KIT-T941
title: hand-write-detect source-shell-write blocks a cap request command as ambiguous shell quoting (pixelvision 2026-11-10): the text had escaped
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:07:33Z
updated: 2026-11-10T17:07:33Z
---

## Description
hand-write-detect source-shell-write blocks a cap request command as ambiguous shell quoting (pixelvision 2026-11-10): the text had escaped double quotes inside single-argument cap text; cap writes the inbox via its own command, not a source file. Gate should not flag cap, t or q invocations.

kit-bug-shape: cap:bug:hand-write-detect-source-shell-write-blocks-a-ca
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 17:07] (created) bug — hand-write-detect source-shell-write blocks a cap request command as ambiguous shell quoting (pixelvision 2026-11-10): the text had escaped
- [2026-11-11 04:28] (landed) a2cb5a3 source-shell-write: a call that cannot write source owns no changed file; bash escapes settle cap/t/q quoting; stale not
