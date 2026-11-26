---
id: KIT-T1593
title: source-shell-gate: a named-path 'git stash push -m <msg> -- <tracked files>' is refused for BOTH a subagent and the main thread when the tra
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T01:05:44Z
updated: 2026-11-26T01:05:44Z
---

## Description
source-shell-gate: a named-path 'git stash push -m <msg> -- <tracked files>' is refused for BOTH a subagent and the main thread when the tracked edits were written by an agent no longer live (road-generator 2026-11-25, rapid-game near_ramp.rs/diamond_line.rs). The subagent's block message said only the main thread may stash; the main thread then got the same refusal with an rm-shaped remedy ('retry the plain rm'), while a pathless 'git stash push' passed. Root cause: the delete rule treats a tracked-file stash as a delete of another writer's file and has no ended-writer case; the remedy text names a verb (rm) that does not fit a stash and contradicts the subagent message. Fix: allow the main thread a named-path stash of tracked files whose writer has ended (the patch-saved WIP case), make the subagent and main-thread messages agree, and print the stash-specific remedy.

kit-bug-shape: cap:bug:source-shell-gate-a-named-path-git-stash-push-m-:f5dbea04
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: hooks/lib/delete-guidance.mjs:38-40 (raiseToMainThread) and :50-51 printed the rm guidance for every named git discard that was not git restore, so a refused 'git stash push -m <msg> -- <tracked files>' told a subagent the main thread removes it with rm and the main thread to retry rm; the verdict itself is hooks/lib/delete-judge.mjs:74 (a named stash of another writer's file goes through the ledger and is refused to every caller, main thread included, ended writer or not) against :73 (the pathless stash is a sweep, passing while no other writer is live). Landed 9439a6bc (text only): a stash way-out shared by subagent and main thread naming what passes today (own files by name; the pathless git stash push -m <note> while no other writer is live; else the main thread runs it later, a subagent raises it), no rm form or revision-leftover hint; DELETE_RULE gains the stash clause; the headline names the git verb. Held, not built: the main-thread lift for an ended writer's tracked files and named-versus-pathless parity both relax a fail-closed gate, and RDG-D191 (2026-11-25) reverted the same kind of allowance (KIT-T1565, cf20d14c undone in 55541f0a) and ruled such false blocks lived with until the one-lexer job KIT-T1585; that needs the maintainer's word. Test: hooks/source-shell-gate-stash-remedy.test.mjs 9 of 15 failed before, 15 pass; discard 44, discard-live 72, main-restore all pass, git-gaps 144, gate-protocol 65.

## History
- [2026-11-26 01:05] (created) bug — source-shell-gate: a named-path 'git stash push -m <msg> -- <tracked files>' is refused for BOTH a subagent and the main thread when the tra
- [2026-11-26 06:14] (landed) 9439a6bc source-shell-gate: a refused named-path git stash prints a stash remedy, the same words for a subagent and the main thre
- [2026-11-26 06:17] (comment) @claude: (fixed) 9439a6bc remedy text only; the lift and parity are held under RDG-D191; runtime 13b83133
