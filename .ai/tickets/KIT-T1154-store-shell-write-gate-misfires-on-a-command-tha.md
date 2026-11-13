---
id: KIT-T1154
title: store-shell-write gate misfires on a command that only removes a source test file (rm rapid-game/rust/world/rg-townplan/tests/tmp_drive.rs)
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T1118, KIT-T1016]
files: []
supersedes:
superseded_by:
created: 2026-11-13T20:35:49Z
updated: 2026-11-13T20:49:45Z
fixed_commit: eab1b32
---

## Description
store-shell-write gate misfires on a command that only removes a source test file (rm rapid-game/rust/world/rg-townplan/tests/tmp_drive.rs) followed by a cargo test piped to grep with an escaped quote in its pattern: nothing under .ai is written; the escaped-quote ambiguity plus any write verb anywhere in the command trips it. Seen again 2026-11-13 by the town agent; earlier captures RDG-INBOX-2026-11-13-0714, RDG-T024 and RDG-T031 notes

kit-bug-shape: cap:bug:store-shell-write-gate-misfires-on-a-command-tha:46eebeb9
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A Bash-tool command that only removes a source test file and greps cargo output with an escaped quote passes the store-shell-write gate; a store write behind the same quoting still blocks

## Plan
1.

## Notes
Cause: hooks/store-shell-gate.mjs called shellStoreWrite without a shell, so the scanner used the legacy rule (any escape before a quote is ambiguous) and the rm token tripped it; source-shell-gate passes shellOfTool since KIT-T941. Fix eab1b32: shellStoreWrite takes { shell }, the gate passes shellOfTool(tool_name). Evidence: node hooks/store-shell-gate.test.mjs 66 passed (the two pass-cases fail without the fix, 64 passed 2 failed), node hooks/shell-write-scan.test.mjs 54 passed. Runtime published at eab1b32. Residual: the PowerShell tool keeps an escape before a quote ambiguous, so a write word in such a line blocks (policy test in store-shell-gate.test.mjs). Proposal not shipped: in an ambiguous line, count a write word only when the raw text can name a protected path (precedent legacy-shell.mjs:44), which loosens a deny gate. Same-cause gap: legacy-shell.mjs segments without a shell (only fires when the command names the legacy dir). Neighbour: KIT-T1118, not reproduced as filed; relatives KIT-T1119, T1077, T1116 were correct blocks of real writes, no change.

## History
- [2026-11-13 20:35] (created) bug — store-shell-write gate misfires on a command that only removes a source test file (rm rapid-game/rust/world/rg-townplan/tests/tmp_drive.rs)
- [2026-11-13 20:48] (landed) eab1b32 store-shell-gate: the gate names the hook's shell, so a bash escaped quote is no ambiguity (implements KIT-T1154, KIT-T1
- [2026-11-13 20:49] (comment) criterion added: A Bash-tool command that only removes a source test file and greps cargo output with an escaped quote passes the store-shell-write gate; a store write behind the same quoting still blocks
- [2026-11-13 20:49] (comment) ticked: A Bash-tool command that only removes a source test file and greps cargo output with an escaped quote passes the store-shell-write gate; a store write behind the same quoting still blocks
- [2026-11-13 20:49] (status) todo → review
