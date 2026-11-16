---
id: KIT-T1286
title: source-shell-write gate refuses the main thread a path-named git restore of tracked files that a cut-off agent left modified. Its text says
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T23:38:28Z
updated: 2026-11-16T00:04:49Z
---

## Description
source-shell-write gate refuses the main thread a path-named git restore of tracked files that a cut-off agent left modified. Its text says such files are left to the main thread, then tells the main thread to commit or restore them first, which is the refused act. Case: road-generator session 2026-11-15, four files under rapid-game rust/world/rg-openworld left by agent a37b9acc2334bdbcb, killed by a usage limit; no live writer held them; the diff was saved first. Wanted: the main thread may run git restore naming each tracked file when the writer that changed them is dead or ended and no live writer holds them; the refusal text names that exact form.

kit-bug-shape: cap:bug:source-shell-write-gate-refuses-the-main-thread-:b125f4b5
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 8c3ea71 (runtime 8c3ea71). The circle: the refusal text said such files are left to the main thread and told the main thread to commit or restore them, and the restore was the refused act. Now the main thread passes a plain git restore of named tracked files (no option, each file named, no directory, glob or dot) when the changes are another writer recorded bytes (the accepted-writes ledger) and no live writer holds the file (fileHolders, read strictly: claims, live sessions listing it dirty, live writers whose Edit left the bytes; a registry that cannot be read keeps the refusal). Refused still: a live writer file (naming the writer), a subagent (told to raise it to the main thread with the exact form), a directory, glob or dot (sweep rule while a writer is live), any option (source, S, W, staged, worktree), checkout and reset hard, and changes NO tool recorded (the maintainer own uncommitted edit: never lifted, the text says ask the maintainer). The refusal texts name the exact form: git restore -- path path ... naming each tracked file. Limit: a writer killed without a stop event keeps its claims for up to the claim window (two hours for an agent) and counts as live until they lapse or are released; no extra death test was invented. Tests: hooks/source-shell-gate-main-restore.test.mjs (dead writer passes for the main thread, three forms; the main own file; live writer refused naming it; subagent refused; unrecorded refused; directory, glob and dot refused; options refused; checkout and reset hard unchanged), mutation-checked (the main-thread condition, the unrecorded lift); the discard-live suite now states the new rule (72); discard 41, sweeps 75, sweeps-live 80, git-gaps 133, wrapped, delete, main-thread, git-integration-guard: no FAIL.

## History
- [2026-11-15 23:38] (created) bug — source-shell-write gate refuses the main thread a path-named git restore of tracked files that a cut-off agent left modified. Its text says
- [2026-11-16 00:04] (landed) 8c3ea71 The main thread may put back tracked files a dead or ended writer left changed: git restore -- <named tracked files> whe
- [2026-11-16 00:04] (status) todo → review
