---
id: KIT-T1011
title: AGENT STALE notice misfires during parallel work (pixelvision 2026-11-11): UserPromptSubmit hook reported six workers as ended with PIX-T007
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:11:33Z
updated: 2026-11-11T04:11:33Z
---

## Description
AGENT STALE notice misfires during parallel work (pixelvision 2026-11-11): UserPromptSubmit hook reported six workers as ended with PIX-T007, T008, T017, T006, T009, T020 open and no Handoff, but ListAgents showed all of them running. Stale detection must check live status before flagging; also it attributed T006, T009 and T020 to one agent id.

kit-bug-shape: cap:bug:agent-stale-notice-misfires-during-parallel-work
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 04:11] (created) bug — AGENT STALE notice misfires during parallel work (pixelvision 2026-11-11): UserPromptSubmit hook reported six workers as ended with PIX-T007
- [2026-11-11 04:28] (landed) a2cb5a3 source-shell-write: a call that cannot write source owns no changed file; bash escapes settle cap/t/q quoting; stale not
- [2026-11-11 04:36] (comment) @claude: Landed a2cb5a3: reconcile reads the subagent transcript (a foreground agent output stub stays empty), handback skips a s (full comment #1 in ## Notes)
### comment #1 [2026-11-11 04:36] @claude
Landed a2cb5a3: reconcile reads the subagent transcript (a foreground agent output stub stays empty), handback skips a stale row whose transcript is live, a brief citing several tickets owns those naming the agent. hooks/agent-reconcile.test.mjs 8 passed, hooks/handback.test.mjs 50 passed. [publish blocked: exported HEAD red on hooks/claim-release-controls.test.mjs, uncommitted KIT-T944 WIP]
