---
id: KIT-T1616
title: process failure: rapid-game layout writer 2 ran grep/sed on a saved log or named file three times (one-file-search gate blocked each); root
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T22:10:06Z
updated: 2026-11-27T22:32:37Z
---

## Description
process failure: rapid-game layout writer 2 ran grep/sed on a saved log or named file three times (one-file-search gate blocked each); root cause: the habit of chaining a log filter onto a redirect in one Bash call; prevention: the writer agent brief's run-to-file example should show the Grep-tool follow-up instead of an inline grep on the saved file

kit-bug-shape: cap:bug:process-failure-rapid-game-layout-writer-2-ran-g:fccf6745
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-27 22:10] (created) bug — process failure: rapid-game layout writer 2 ran grep/sed on a saved log or named file three times (one-file-search gate blocked each); root
- [2026-11-27 22:27] (landed) 803e14d2 one-file-search: an awk over a saved log is refused whatever its program, and gawk, mawk and nawk are judged as awk; age
- [2026-11-27 22:28] (comment) @claude: fixed 803e14d2: docs/wait-rule.md, all 20 agents/*.md, the rg-* search lines and the SubagentStart guide say a saved log (full comment #1 in ## Notes)
### comment #1 [2026-11-27 22:28] @claude
fixed 803e14d2: docs/wait-rule.md, all 20 agents/*.md, the rg-* search lines and the SubagentStart guide say a saved log is read with Read or searched with the Grep tool on that one file in a call of its own; own output is filtered inline with no file, never a filter of the saved file chained in the call that wrote it
- [2026-11-27 22:32] (status) todo → review
