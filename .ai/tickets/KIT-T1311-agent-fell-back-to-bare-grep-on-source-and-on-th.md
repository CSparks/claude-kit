---
id: KIT-T1311
title: agent fell back to bare grep on source and on the .ai store after a q query returned few rows; gates blocked twice (source-discovery, store-
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T11:33:44Z
updated: 2026-11-16T11:37:35Z
---

## Description
agent fell back to bare grep on source and on the .ai store after a q query returned few rows; gates blocked twice (source-discovery, store-grep); prevention: q must print its fallback (q code --regex with --path, q fts) in its empty-result message, and the agent brief must say 'q code -C for context, never grep'

kit-bug-shape: cap:bug:agent-fell-back-to-bare-grep-on-source-and-on-th:3823b28b
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
The .ai case was already covered: the store-grep block prints 'Exact equivalent: q fts <terms>' (or q show <id> for an item path) and lists governing/trail/show/fts/open (hooks/query-gate.mjs storeMsg). Two gaps fixed: (1) the exact line for an alternation store grep passed the regex to fts as one term; it now prints 'q fts a b --any'; (2) an empty q code answer printed only '(no results)' and the NOT searched caution; it now adds 'No hits: try --regex, -i, a wider --path, -C 2; work items are q fts <terms> [--any], one item q show <id>. Never grep.' (code-index-query emptyHint). Tests: scripts/q-gaps.test.mjs 16 passed (2 new), hooks/query-gate.test.mjs all pass (2 new), code-index 30, q 112, kit-bug exit 0.

## History
- [2026-11-16 11:33] (created) bug — agent fell back to bare grep on source and on the .ai store after a q query returned few rows; gates blocked twice (source-discovery, store-
- [2026-11-16 11:37] (status) todo → review
