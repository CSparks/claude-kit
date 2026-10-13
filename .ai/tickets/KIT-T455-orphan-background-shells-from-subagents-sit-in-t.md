---
id: KIT-T455
title: Orphan background shells from subagents sit in the maintainer's task list with a dead timer (recurring; Chris 2026-10-13 'annoying recurring
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T20:12:47Z
updated: 2026-10-13T20:34:11Z
---

## Description
Orphan background shells from subagents sit in the maintainer's task list with a dead timer (recurring; Chris 2026-10-13 'annoying recurring problem'). Case: the extractions writer's step-8 shell (ChunkGround -> RegionGround edits + a 60-min nextest run, task bee28ye76, started 08:12) stayed listed for 7 h after the writer finished and its commit 87689602 landed; the orchestrator's ListAgents does not show background shells, so it looked for an agent and told Chris it was not in the session. Root cause: no cleanup of a subagent's background shells at SubagentStop, and no orchestrator-visible listing of them (ListAgents lists agents only; the only trace is the tasks/*.output dir). Fix at the kit: SubagentStop hook enumerates the stopped agent's background shell tasks (tasks dir rows without '[exited') and reports them in the hand-back so the orchestrator stops them, or stops them itself; orient's In-flight agents section lists never-exited background shells older than 30 min as ORPHAN with the stop command; a Stop-hook nag when any orphan shell is older than the last turn.

kit-bug-shape: cap:bug:orphan-background-shells-from-subagents-sit-in-t
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 20:12] (created) bug — Orphan background shells from subagents sit in the maintainer's task list with a dead timer (recurring; Chris 2026-10-13 'annoying recurring
- [2026-10-13 20:34] (status) todo → review
- [2026-10-13 20:34] (comment) 277e59b; hooks/orphan-shells.test.mjs 13 passed; npm test exit 0
