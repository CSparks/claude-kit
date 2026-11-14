---
id: KIT-T1162
title: source-shell-gate: rm with an unresolved variable operand (F=crates/a.rs; rm "$F") passes for any caller because the variable text has no so
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T22:57:45Z
updated: 2026-11-14T00:10:11Z
---

## Description
source-shell-gate: rm with an unresolved variable operand (F=crates/a.rs; rm "$F") passes for any caller because the variable text has no source extension, while a redirect to a variable path blocks; the delete lift (KIT-T1156) judges only literal operands, so rm of a variable path should resolve it (precedingValues) or block as unprovable

kit-bug-shape: cap:bug:source-shell-gate-rm-with-an-unresolved-variable:e68d7653
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] An rm whose operand a shell variable supplies is judged by the literal the command assigns it, and refused naming the operand when it does not resolve (variable in a deciding component, every component when recursive, a substitution, a backtick, a PowerShell subexpression); hooks/source-shell-gate-delete.test.mjs 62 passed, 8+11 failed before (95dc46b, f2bad4d)

## Plan
1.

## Notes
Fixed 95dc46b, f2bad4d (and the review gaps closed in f2bad4d). hooks/source-shell-gate-delete.test.mjs 62 passed (11 then 8 failed before). Reading: a non-recursive rm refuses a variable only in the deciding (last) component or behind a source-looking name; a recursive rm refuses it in any component. Idioms that now block inside an adopted repo, by the brief: a trap that removes an unresolved TMP variable, and rm words inside echo text. The variable rule is the source gate only (store and legacy gates unchanged).

## History
- [2026-11-13 22:57] (created) bug — source-shell-gate: rm with an unresolved variable operand (F=crates/a.rs; rm "$F") passes for any caller because the variable text has no so
- [2026-11-13 23:46] (landed) 95dc46b source-shell-gate: a delete operand a variable supplies is judged by the literal the command assigns it or refused, and
- [2026-11-13 23:59] (landed) f2bad4d source-shell-gate: close four bypasses of the delete judgement: --pathspec-from-file and --pathspec-file-nul make a git
- [2026-11-14 00:09] (comment) criterion added: An rm whose operand a shell variable supplies is judged by the literal the command assigns it, and refused naming the operand when it does not resolve (variable in a deciding component, every component when recursive, a substitution, a backtick, a PowerShell subexpression); hooks/source-shell-gate-delete.test.mjs 62 passed, 8+11 failed before (95dc46b, f2bad4d)
- [2026-11-14 00:09] (comment) ticked: An rm whose operand a shell variable supplies is judged by the literal the command assigns it, and refused naming the operand when it does not resolve (variable in a deciding component, every component when recursive, a substitution, a backtick, a PowerShell subexpression); hooks/source-shell-gate-delete.test.mjs 62 passed, 8+11 failed before (95dc46b, f2bad4d)
- [2026-11-14 00:10] (status) todo → review
