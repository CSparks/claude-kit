---
id: KIT-T1026
title: hand-write-detect (source-shell-write) flags 'cargo fmt -p <crate>' as a hand write of 10 source files though its own block text says format
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T06:29:27Z
updated: 2026-11-11T06:29:27Z
---

## Description
hand-write-detect (source-shell-write) flags 'cargo fmt -p <crate>' as a hand write of 10 source files though its own block text says formatter output is not a hand write and to run the tool; the gate demands a re-save of each file through Edit/Write before a commit (road-generator RDG-T004, 2026-11-11)

kit-bug-shape: cap:bug:hand-write-detect-source-shell-write-flags-cargo
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 06:29] (created) bug — hand-write-detect (source-shell-write) flags 'cargo fmt -p <crate>' as a hand write of 10 source files though its own block text says format
