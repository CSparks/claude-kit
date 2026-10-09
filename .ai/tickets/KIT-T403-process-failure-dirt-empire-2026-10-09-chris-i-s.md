---
id: KIT-T403
title: Process failure (dirt-empire 2026-10-09, Chris: 'I see two agents. Neither is prefixed by the model they're using'): both dispatches carried
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T21:05:24Z
updated: 2026-10-09T21:28:04Z
---

## Description
Process failure (dirt-empire 2026-10-09, Chris: 'I see two agents. Neither is prefixed by the model they're using'): both dispatches carried the mandated [opus] prefix in the Agent description and an explicit model, and the dispatch-ladder hook rewrote completed ones to '[Opus 5.5] ...' - but the model label lives ONLY in the description field, which the running-agent roster (ListAgents / FleetView rows show id + subagent_type only) and .ai/agents.jsonl rows (ts/id/status/source only) do not carry. ROOT CAUSE: the label contract puts the model where the maintainer's live view cannot show it. FIX: the PostToolUse(Task) hook records the resolved model on the agents.jsonl row and the roster/orient 'In-flight agents' line prints it; the dispatch-ladder hook should also refuse a dispatch whose roster entry would be unlabelled, not just rewrite the description

kit-bug-shape: cap:bug:process-failure-dirt-empire-2026-10-09-chris-i-s
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 21:05] (created) bug — Process failure (dirt-empire 2026-10-09, Chris: 'I see two agents. Neither is prefixed by the model they're using'): both dispatches carried
- [2026-10-09 21:06] (status) todo → doing
- [2026-10-09 21:06] (comment) @chris: Chris 2026-10-09: 'I don't want you to have to tell me that. I want to see it at a glance.' then 'And I want it enforced (full comment #1 in ## Notes)
### comment #1 [2026-10-09 21:06] @chris
Chris 2026-10-09: 'I don't want you to have to tell me that. I want to see it at a glance.' then 'And I want it enforced.' - the model on every agent row/listing is a HARD GATE: dispatch without a resolvable model blocked (exit 2), unlabelled ledger row refused, orient flags any legacy unlabelled row with !!
- [2026-10-09 21:18] (comment) @chris: 2026-10-09: Chris asked for ENFORCEMENT. Built: dispatch-guard unlabelledBlock (exit 2), agent-roster refuses unlabelled (full comment #2 in ## Notes)
### comment #2 [2026-10-09 21:18] @chris
2026-10-09: Chris asked for ENFORCEMENT. Built: dispatch-guard unlabelledBlock (exit 2), agent-roster refuses unlabelled rows (exit 2), hooks/lib/agent-format.mjs single formatter ([model?] never blank), orient !! lint. Running full suite.
- [2026-10-09 21:28] (comment) @chris: 2026-10-09: tests: all kit suites green (hooks model-tag 70, agent-roster 46, dispatch-guard, progress, orient); server/*.test fails pre-existing (express not installed).
- [2026-10-09 21:28] (status) doing → review
