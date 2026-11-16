---
id: KIT-T1193
title: process: a subagent grepped a source directory with a two-file glob (side.rs, seed/footprint.rs) to read four function signatures and was bl
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-14T05:51:12Z
updated: 2026-11-16T10:06:52Z
---

## Description
process: a subagent grepped a source directory with a two-file glob (side.rs, seed/footprint.rs) to read four function signatures and was blocked by source-discovery; root cause: batching two known files into one directory search instead of q sym or one Grep a file; prevention: the agent brief's search line could say 'two known files = two Grep calls or q sym, never a directory with a glob'.

kit-bug-shape: cap:bug:process-a-subagent-grepped-a-source-directory-wi:e9dbe9b2
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-14 05:51] (created) bug — process: a subagent grepped a source directory with a two-file glob (side.rs, seed/footprint.rs) to read four function signatures and was bl
- [2026-11-16 10:06] (status) todo → review
