---
id: KIT-T1356
title: A TaskStop-killed agent stays 'in-flight' in .ai/agents.jsonl (row a6eb8222d80efa278, 2026-11-17T23:47Z, status in-flight after the task was
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T23:59:39Z
updated: 2026-11-18T00:20:08Z
fixed_commit: b900b4a1
---

## Description
A TaskStop-killed agent stays 'in-flight' in .ai/agents.jsonl (row a6eb8222d80efa278, 2026-11-17T23:47Z, status in-flight after the task was stopped): the shared-tree dispatch gate then refuses a replacement with overlapping paths (KIT dispatch guard). The roster has no 'killed' status written by TaskStop/SubagentStop and no sanctioned command to clear a dead row; needed: mark killed agents ended (hook on stop or on the killed notification), plus a command to retire a dead row by id

kit-bug-shape: cap:bug:a-taskstop-killed-agent-stays-in-flight-in-ai-ag:d8cdaa91
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] The dispatch gate stops counting an in-flight row whose agent's subagent transcript ends on the harness interruption turn (TaskStop or Esc), decided at read time so a SendMessage resume counts again; live writers still block on overlap (hooks/task-stop-roster.test.mjs)
- [x] claims --release <id> --reason ends a claimless agent's in-flight roster row as killed after the quiet check on its transcript, and refuses while the transcript moved in the last QUIET_MIN minutes (hooks/claims-release-verb.test.mjs)
- [x] The shared-tree refusal names the main thread's clear command: claims --release <agent id> --reason
- [x] The road-generator row a6eb8222d80efa278 no longer blocks the replacement dispatch's exact [paths:] under the guard's own query

## Plan
1.

## Notes
Root cause: the harness ran no PostToolUse hook for the TaskStop at 2026-11-17T23:58:53Z in road-generator session 4100d9bf. Evidence: that session's gate heartbeats (<tmp>/claude-kit-turnstate/gate-heartbeats/4100d9bf-...) carry tool.Read, tool.Agent and others but no tool.TaskStop, though PostToolUse has a matcher-less hook (broken-crate-notice) that marks every tool it sees; and the agent's claim file in the holders registry survived until 00:02Z, while recordKill's first step is releaseAgent. The hook works on a copy of the real roster with the real payload. The earlier TaskStop at 2026-11-17T01:07Z in the same session also left no row. So KIT-T362's hook close is not reliable; the gate now reads the harness's own record (the subagent transcript's last entry, '[Request interrupted by user ...') at read time, without writing a terminal row (a killed agent can be resumed by SendMessage). The main thread's claims --release now also ends a claimless agent's in-flight row. Tests: hooks/task-stop-roster.test.mjs 23 passed; hooks/claims-release-verb.test.mjs all pass; agent-reconcile, dispatch-shared-tree, dispatch-guard, dispatch-holder pass; agent-roster.test.mjs 47/48 with the anchor case failing identically at HEAD c00dd351 (pre-existing, flush.mjs).

## History
- [2026-11-17 23:59] (created) bug — A TaskStop-killed agent stays 'in-flight' in .ai/agents.jsonl (row a6eb8222d80efa278, 2026-11-17T23:47Z, status in-flight after the task was
- [2026-11-18 00:17] (status) todo → doing
- [2026-11-18 00:17] (comment) criterion added: The dispatch gate stops counting an in-flight row whose agent's subagent transcript ends on the harness interruption turn (TaskStop or Esc), decided at read time so a SendMessage resume counts again; live writers still block on overlap (hooks/task-stop-roster.test.mjs)
- [2026-11-18 00:17] (comment) criterion added: claims --release <id> --reason ends a claimless agent's in-flight roster row as killed after the quiet check on its transcript, and refuses while the transcript moved in the last QUIET_MIN minutes (hooks/claims-release-verb.test.mjs)
- [2026-11-18 00:18] (comment) criterion added: The shared-tree refusal names the main thread's clear command: claims --release <agent id> --reason
- [2026-11-18 00:18] (comment) criterion added: The road-generator row a6eb8222d80efa278 no longer blocks the replacement dispatch's exact [paths:] under the guard's own query
- [2026-11-18 00:18] (comment) ticked: hooks/task-stop-roster.test.mjs 23 passed
- [2026-11-18 00:19] (comment) ticked: hooks/claims-release-verb.test.mjs all pass (49 ok)
- [2026-11-18 00:19] (comment) ticked: The shared-tree refusal names the main thread's clear command: claims --release <agent id> --reason
- [2026-11-18 00:19] (comment) ticked: live dispatch-guard.mjs run in D:/dev/road-generator with the replacement's exact [paths:]: no shared-tree block; sealed c00dd351 still blocks on a6eb8222d80efa278
- [2026-11-18 00:19] (landed) b900b4a1 dispatch gate: a writer the harness stopped (its subagent transcript ends on the interruption turn) stops counting, read
- [2026-11-18 00:20] (status) doing → review
- [2026-11-18 00:20] (comment) runtime b900b4a1 published
