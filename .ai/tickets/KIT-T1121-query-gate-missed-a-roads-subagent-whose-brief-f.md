---
id: KIT-T1121
title: query-gate missed: a roads subagent whose brief forbade grep/tail/head/cut/cat/ls/wc on source and output ran them in Bash pipelines (grep -
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T07:00:05Z
updated: 2026-11-13T13:56:12Z
---

## Description
query-gate missed: a roads subagent whose brief forbade grep/tail/head/cut/cat/ls/wc on source and output ran them in Bash pipelines (grep -E on census output in the scratchpad, wc -l and ls on rg-roadworks/src, cat roads.ron, tail -c on q show) about 15 times unblocked; root cause: the agent reached for POSIX filters out of habit instead of PowerShell Select-String/Read/q; prevention: the gate should refuse these filters on repo source and on a scratchpad file of command output, and name the q / Select-String equivalent

kit-bug-shape: cap:bug:query-gate-missed-a-roads-subagent-whose-brief-f
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed 991e94c (pushed), runtime 991e94c. Scope decided from the gate header and the record: the gate's rule (hooks/query-gate.mjs header, KIT-T464, KIT-T1106) is: tree-wide source discovery blocks; a search of ONE named file, a filter over a command's own output (cargo test | grep/head/tail/cut/wc), a scratchpad file, ls/wc/cat of named files and find -name filename lookups (KIT-T272) pass. head/tail/cut/cat/ls/wc are not searches and stay unjudged. The real gap was discovery laundered through a pipe, reproduced by the battery before the fix (all exit 0): find|xargs grep (no -r), git ls-files|xargs grep, xargs cat|grep, cat/head/tail of a glob|grep, PowerShell Get-ChildItem|Select-String, and a non-recursive grep over a glob. Fix: hooks/lib/pipe-tree-search.mjs (blocks those; message names q code, 'grep <pattern> <file>', the build-output filter form cargo test 2>&1 | grep -E ... | tail -20, and q code --dir for logs); a glob operand now takes the recursive path (JS/TS glob blocks, non-indexed glob such as *.rs or *.md passes per KIT-T085). Tests: hooks/query-gate-pipes.test.mjs 51 passed (10 bash + 4 PowerShell blocks, 26 bash + 4 PowerShell negative controls, message and glob cases); query-gate 140, git-search 49, index-redirect 44, block-triage 13 passed. The source-shell gate is write-side: no change. NOT built, needs the maintainer: KIT-D134 literal scope (block EVERY grep/rg in Bash incl. single-file and piped output filters; KIT-T871 remainder) collides with KIT-T1106 tests, KIT-T1064 and the kit's own output-filter practice (KIT-T355), so it stays a ruling. KIT-T464 keeps scratchpad greps allowed; the ticket's 'refuse grep on a scratchpad file' is not applied. Not verified: that the road subagents' Bash calls reached the hook (the reproduction ran the hook directly).

## History
- [2026-11-13 07:00] (created) bug — query-gate missed: a roads subagent whose brief forbade grep/tail/head/cut/cat/ls/wc on source and output ran them in Bash pipelines (grep -
- [2026-11-13 13:55] (landed) 991e94c query-gate: a search fed a set of source files through a pipe is discovery and blocks, naming q code and the forms that
- [2026-11-13 13:56] (comment) @claude: fixed 991e94c; hooks/query-gate-pipes.test.mjs 51 passed, query-gate.test.mjs 140 passed
- [2026-11-13 13:56] (status) todo → review
