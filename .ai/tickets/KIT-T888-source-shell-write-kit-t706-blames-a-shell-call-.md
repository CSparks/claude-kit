---
id: KIT-T888
title: source-shell-write (KIT-T706) blames a shell call for source files another session's writer changed in the same checkout: this agent's node/
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-07T18:16:10Z
updated: 2026-11-09T23:20:24Z
---

## Description
source-shell-write (KIT-T706) blames a shell call for source files another session's writer changed in the same checkout: this agent's node/test calls were told they hand-wrote scripts/broker/*.mjs and hooks/build-wrap* that the concurrent KIT-T879 implementer wrote; attribution must use this session's own writes (relates KIT-T792, KIT-T849)

kit-bug-shape: cap:bug:source-shell-write-kit-t706-blames-a-shell-call-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-07 18:16] (created) bug — source-shell-write (KIT-T706) blames a shell call for source files another session's writer changed in the same checkout: this agent's node/
- [2026-11-08 19:32] (comment) @claude: Recurrence 2026-11-08, groovegrid orchestrator session da28715f: PostToolUse hand-write-detect (source-shell-write, KIT- (full comment #1 in ## Notes)
### comment #1 [2026-11-08 19:32] @claude
Recurrence 2026-11-08, groovegrid orchestrator session da28715f: PostToolUse hand-write-detect (source-shell-write, KIT-T706) twice blamed my Bash calls for source files another writer changed in the claude-kit checkout (hooks/lib/assistant-text.mjs; hooks/land-alert.mjs, hooks/request-gate.mjs). My calls only ran t, cap, q and a heredoc into the scratchpad; I edited no kit source file. The gate says a commit holding the files is refused until re-saved, which would make me touch another writer files. Not re-saved.
- [2026-11-09 23:15] (comment) @claude: Recurrence 2026-11-09 (groovegrid): hand-write-detect blamed my Bash call (t decide, t comment, q fts: no source writes) (full comment #2 in ## Notes)
### comment #2 [2026-11-09 23:15] @claude
Recurrence 2026-11-09 (groovegrid): hand-write-detect blamed my Bash call (t decide, t comment, q fts: no source writes) for src/ui/song/SongCurveRow.cpp, a file a parallel writer agent (a8fcee4e8e904a80e) was editing in the same checkout. The detector attributes any changed source file to whichever shell call ran last. Fix: attribute only files the shell call itself wrote (before/after snapshot scoped to that call, or the command's own write targets), never another agent's concurrent edits.
- [2026-11-09 23:20] (status) todo → review
- [2026-11-09 23:20] (landed) 602b5d5 hand-write-detect: a source file an Edit or Write of any session recorded during the shell call is that tool's write, ne
- [2026-11-09 23:25] (comment) @claude: Second recurrence 2026-11-09 (groovegrid): hand-write-detect flagged src/ui/song/SongCurveRow.h after a read-only agent's 'q file' call; the concurrent writer a8fcee4e8e904a80e had changed it.
- [2026-11-09 23:46] (landed) 2f2d069 hand-write-detect: the exemption for another writer's concurrent edit rests on a separate accepted-writes ledger written
- [2026-11-09 23:49] (landed) 4819d6d plugin 0.1.35: sessions pick up the tool-write-record hook registration, the agent-definition triage section and the wor
- [2026-11-11 04:28] (landed) a2cb5a3 source-shell-write: a call that cannot write source owns no changed file; bash escapes settle cap/t/q quoting; stale not
- [2026-11-11 04:36] (landed) ea3678f inert-command: node --test counts only among node's own options in a repo test run with no preload; an untrusted line fa
