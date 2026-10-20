---
id: KIT-T591
title: query-gate allows the Grep tool for tree-wide code discovery after blocking bash grep, so an agent can route around q without filing the gap
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T22:42:26Z
updated: 2026-10-20T00:53:02Z
fixed_commit: b6dd07f
---

## Description
query-gate allows the Grep tool for tree-wide code discovery after blocking bash grep, so an agent can route around q without filing the gap (process failure, DE-T172 2026-10-19)

kit-bug-shape: cap:bug:query-gate-allows-the-grep-tool-for-tree-wide-co
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 22:42] (created) bug — query-gate allows the Grep tool for tree-wide code discovery after blocking bash grep, so an agent can route around q without filing the gap
- [2026-10-20 00:53] (status) todo → review
- [2026-10-20 00:53] (comment) query-gate judges the Grep tool as the rg it is (hooks/lib/grep-tool-command.mjs, hooks.json matcher Bash|PowerShell|Grep); test hooks/query-gate.test.mjs (Grep tool cases, all pass)
