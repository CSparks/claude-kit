---
id: KIT-T1348
title: PROCESS FAILURE class: subagents use Grep with a directory path and grep on a log file (query-gate blocks 'source-discovery' and 'one-file-s
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T19:18:50Z
updated: 2026-11-17T19:18:50Z
---

## Description
PROCESS FAILURE class: subagents use Grep with a directory path and grep on a log file (query-gate blocks 'source-discovery' and 'one-file-search') despite the brief saying 'Search with q, never grep'. Prevention: the implementation agent definition/brief template should name q code --dir <log> for build logs and the Read tool for one file

kit-bug-shape: cap:bug:process-failure-class-subagents-use-grep-with-a-:67b31b98
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Agent definitions already carried 'Search with q, never grep' and the gate block already prints the exact q or Read replacement; the gap was no target-to-tool map (directory -> q, one file -> Read, log -> q code --dir). Added 'Pick the tool by target' to the Search section of all 15 agent definitions and the dispatch-brief line of commands/work.md and drain.md; plugin 0.1.56. Test: scripts/search-adoption.test.mjs (8 passed), contract-rules 48, agent-timeout-rule 115, plugin-drift 14. No check loosened.

## History
- [2026-11-17 19:18] (created) bug — PROCESS FAILURE class: subagents use Grep with a directory path and grep on a log file (query-gate blocks 'source-discovery' and 'one-file-s
