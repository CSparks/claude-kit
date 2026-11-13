---
id: KIT-T1156
title: source-shell-write gate blocks 'rm <file>' of an untracked scratch test (crates/road-generator/tests/dbg_town.rs) as a hand write and names
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T20:57:58Z
updated: 2026-11-13T22:56:43Z
---

## Description
source-shell-write gate blocks 'rm <file>' of an untracked scratch test (crates/road-generator/tests/dbg_town.rs) as a hand write and names no sanctioned way to delete a source file; a subagent has no tool to remove its own throwaway file

kit-bug-shape: cap:bug:source-shell-write-gate-blocks-rm-file-of-an-unt:294a6adf
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A shell rm of an untracked file the caller wrote passes when a later segment cds into another repo (the relative path resolves against the cd segments before its own segment); a refused delete names why and the way out; a tracked file and another writer's file stay refused (hooks/source-shell-gate-delete.test.mjs: 9 of 33 failed before, 33 passed after; 45e6cf0)

## Plan
1.

## Notes
Cause (reproduced, hooks/source-shell-gate.mjs before 45e6cf0): the failing command was 'rm crates/road-generator/tests/dbg_town.rs && cd rapid-game && git status ...' (transcript agent-addaaeec7a57bac02, 20:57). The gate resolved EVERY hit's relative path against the directory after ALL cd segments, so the rm operand resolved to rapid-game/crates/..., a missing file in another repo, and ownsUntrackedFile answered false. The ledger held the agent's own entry (writer bf054b5b|addaaeec7a57bac02, hash equal to the file). Fix 45e6cf0: each hit carries its segment index and commandCwd(command, start, {upto, shell}) gives the directory at that segment; deleteRefusal() returns why a delete is refused (no-writer, glob, missing, tracked, unrecorded, other-writer) and lib/delete-guidance.mjs prints the rule and the one way out (missing prints the resolved path and the directory at that point; tracked names git rm; another writer's file has no sanctioned shell verb, raise it to the main thread); q gates source prints the rule. Side effect, a tightening: 'echo x > a.rs && cd C:/Windows' passed before (a.rs resolved outside any repo) and is now judged in the repo. Tests run: source-shell-gate-delete 33 passed; shell-write-scan 54; source-shell-gate 168; -escapes 11; -touch 113; -wrapped 238; gate-protocol 52; store-shell-gate 66; shell-writes 15. Not fixed, filed in the report: git clean -f -- <path>, git rm -f and git stash push -u pass every kit gate, so they delete another writer's untracked file; a bash 'F=x; rm $F' with an unresolved variable has no source extension and passes. The ledger read is capped at 300 entries per checkout (tool-write-ledger.mjs), so a busy checkout can evict an owner's entry.

## History
- [2026-11-13 20:57] (created) bug — source-shell-write gate blocks 'rm <file>' of an untracked scratch test (crates/road-generator/tests/dbg_town.rs) as a hand write and names
- [2026-11-13 22:48] (landed) 45e6cf0 source-shell-gate: a relative path resolves against the cd segments before its own segment, so rm of an owned file befor
- [2026-11-13 22:56] (comment) criterion added: A shell rm of an untracked file the caller wrote passes when a later segment cds into another repo (the relative path resolves against the cd segments before its own segment); a refused delete names why and the way out; a tracked file and another writer's file stay refused (hooks/source-shell-gate-delete.test.mjs: 9 of 33 failed before, 33 passed after; 45e6cf0)
- [2026-11-13 22:56] (comment) ticked: A shell rm of an untracked file the caller wrote passes when a later segment cds into another repo (the relative path resolves against the cd segments before its own segment); a refused delete names why and the way out; a tracked file and another writer's file stay refused (hooks/source-shell-gate-delete.test.mjs: 9 of 33 failed before, 33 passed after; 45e6cf0)
- [2026-11-13 22:56] (comment) @claude: (fixed) 45e6cf0; source-shell-gate-delete.test.mjs 33 passed (9 failed before)
- [2026-11-13 22:56] (status) todo → review
