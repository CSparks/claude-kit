---
id: KIT-T1165
title: source-shell-write gate misfires on 'cp target/debug/probe.exe $S/probe.exe' (copying a built exe into a scratch dir): reports 'writes a sou
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T23:04:17Z
updated: 2026-11-13T23:19:43Z
---

## Description
source-shell-write gate misfires on 'cp target/debug/probe.exe $S/probe.exe' (copying a built exe into a scratch dir): reports 'writes a source file by hand ($S/probe.exe/any.rs)'; a cp of a binary is not a source write

kit-bug-shape: cap:bug:source-shell-write-gate-misfires-on-cp-target-de:d104ad0b
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A cp of built exes into a scratch directory named by a variable assigned in the same && chain (also behind a cd prefix) passes; a copy onto repo source, from scratch into the repo, behind a semicolon after the cd, before the assignment, or of a never-assigned variable stays blocked (hooks/source-shell-gate-chained.test.mjs: 4 of 13 failed before, 13 passed after; 66e27a6)

## Plan
1.

## Notes
Cause: the real command (transcript agent-a80c457bf2a0b00fc, 23:04) was S=scratch-path && mkdir -p S && cp target/debug/probe.exe S/probe.exe && ... && git diff --stat -- file && ls S, with S written as a dollar variable. The source operand (an .exe under target/) was never the problem: the destination held an unresolved variable. The strict resolver (assignedValues) trusts a command only when every segment is known to leave variables alone, and git was not on that list, so no variable resolved; and an assignment behind a cd prefix and && was never visible. Fix 66e27a6: git joins the safe commands (a child process cannot bind a parent variable; cargo, rg, grep, head, tail, cat, wc joined earlier), and an assignment in an && chain is visible to the segments joined to it by && alone (such a segment runs only when the assignment ran). A semicolon, pipe or || ends the chain, so the conditional-assignment bypass stays closed. Tests: source-shell-gate-chained 13 (4 failed before); shell-variables-allowlist 192; shell-copy-target 76; shell-copy-target-dir 58; shell-rebinder-qualifiers 23; commit-gate-message-file 20; source-shell-gate 168, -wrapped 238, -delete 33, -touch 113; shell-write-scan 54; query-gate-variables all passed.

## History
- [2026-11-13 23:04] (created) bug — source-shell-write gate misfires on 'cp target/debug/probe.exe $S/probe.exe' (copying a built exe into a scratch dir): reports 'writes a sou
- [2026-11-13 23:18] (landed) 66e27a6 shell-variables: an assignment behind cd dir && (any && chain) is visible to the segments joined to it by && alone, and
- [2026-11-13 23:19] (comment) criterion added: A cp of built exes into a scratch directory named by a variable assigned in the same && chain (also behind a cd prefix) passes; a copy onto repo source, from scratch into the repo, behind a semicolon after the cd, before the assignment, or of a never-assigned variable stays blocked (hooks/source-shell-gate-chained.test.mjs: 4 of 13 failed before, 13 passed after; 66e27a6)
- [2026-11-13 23:19] (comment) ticked: A cp of built exes into a scratch directory named by a variable assigned in the same && chain (also behind a cd prefix) passes; a copy onto repo source, from scratch into the repo, behind a semicolon after the cd, before the assignment, or of a never-assigned variable stays blocked (hooks/source-shell-gate-chained.test.mjs: 4 of 13 failed before, 13 passed after; 66e27a6)
- [2026-11-13 23:19] (comment) @claude: (fixed) 66e27a6; source-shell-gate-chained.test.mjs 13 passed (4 failed before)
- [2026-11-13 23:19] (status) todo → review
