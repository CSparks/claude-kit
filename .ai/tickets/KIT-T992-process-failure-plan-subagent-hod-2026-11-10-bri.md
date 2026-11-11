---
id: KIT-T992
title: process failure (Plan subagent, HOD 2026-11-10): brief said 'Search with q, never grep' yet the agent ran grep -n and a recursive grep -rl;
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:22:05Z
updated: 2026-11-11T03:22:05Z
---

## Description
process failure (Plan subagent, HOD 2026-11-10): brief said 'Search with q, never grep' yet the agent ran grep -n and a recursive grep -rl; query-gate blocked the latter. A read-only plan agent cannot ticket. Prevention: the dispatch gate (or Plan agent definition) injects the q-only rule and the agent's Bash tool for read-only types rejects grep/rg up front.

kit-bug-shape: cap:bug:process-failure-plan-subagent-hod-2026-11-10-bri
first seen in hustle-or-die. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:22] (created) bug — process failure (Plan subagent, HOD 2026-11-10): brief said 'Search with q, never grep' yet the agent ran grep -n and a recursive grep -rl;
