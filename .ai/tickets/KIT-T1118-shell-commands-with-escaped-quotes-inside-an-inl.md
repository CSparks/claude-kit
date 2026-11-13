---
id: KIT-T1118
title: Shell commands with escaped quotes inside an inline powershell -Command trip store-shell-write: an agent piping cargo output through Where-O
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1154]
files: []
supersedes:
superseded_by:
created: 2026-11-13T05:41:15Z
updated: 2026-11-13T20:49:48Z
fixed_commit: eab1b32
---

## Description
Shell commands with escaped quotes inside an inline powershell -Command trip store-shell-write: an agent piping cargo output through Where-Object with escaped dollar signs got blocked; prevention: agent briefs and the kit's waiting-on-builds guidance should name a scratchpad .ps1 filter script (env var pattern, args as the command) as the way to filter output without grep

kit-bug-shape: cap:bug:shell-commands-with-escaped-quotes-inside-an-inl
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Evidence: fix eab1b32 (see KIT-T1154); node hooks/store-shell-gate.test.mjs 66 passed incl. a KIT-T1118 case: rm plus a Bash-tool powershell -Command filter with escaped quotes passes. The PowerShell-tool shape stays ambiguous by design; reopen with the exact command if it recurs.

## History
- [2026-11-13 05:41] (created) bug — Shell commands with escaped quotes inside an inline powershell -Command trip store-shell-write: an agent piping cargo output through Where-O
- [2026-11-13 20:48] (landed) eab1b32 store-shell-gate: the gate names the hook's shell, so a bash escaped quote is no ambiguity (implements KIT-T1154, KIT-T1
- [2026-11-13 20:49] (comment) @claude: Neighbour of KIT-T1154, not reproduced as filed. The refused command text is on no record (RDG-T066 Notes cite only KIT- (full comment #1 in ## Notes)
### comment #1 [2026-11-13 20:49] @claude
Neighbour of KIT-T1154, not reproduced as filed. The refused command text is on no record (RDG-T066 Notes cite only KIT-T1154). Shared cause fixed in eab1b32: store-shell-gate passed no shell to the scanner, so any escape before a quote was ambiguous; it now passes shellOfTool(tool_name), and a Bash-tool powershell -Command filter with escaped quotes plus an rm passes (test KIT-T1118 in hooks/store-shell-gate.test.mjs). Still ambiguous by design: the PowerShell tool with a backslash or backtick before a quote, a $' string, an unclosed quote; a write word in such a line blocks. If it recurs under the PowerShell tool, capture the exact command text with the ambiguity span the block now prints.
- [2026-11-13 20:49] (status) todo → review
