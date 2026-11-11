---
id: KIT-T1073
title: process failure (3 recurrences in one run): a kit agent edited source with a node heredoc twice (source-shell-gate blocked both, correctly)
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T19:05:41Z
updated: 2026-11-11T19:05:41Z
---

## Description
process failure (3 recurrences in one run): a kit agent edited source with a node heredoc twice (source-shell-gate blocked both, correctly) and ran git stash and stash pop on a source file as a mutation control (hand-write-detect flagged it). Root cause: no mutation-control recipe in the kit agent brief. Prevention: controls run against a scratchpad git archive copy of the previous revision, never a stash of the live file; tie it to the implementation agent definition

kit-bug-shape: cap:bug:process-failure-3-recurrences-in-one-run-a-kit-a
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 19:05] (created) bug — process failure (3 recurrences in one run): a kit agent edited source with a node heredoc twice (source-shell-gate blocked both, correctly)
