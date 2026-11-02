---
id: KIT-T818
title: dispatch-guard handoff-before-replace (KIT-D116) demands a 'Handoff <agent-id>' block on every ticket a past-ceiling agent ever touched, inc
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T23:48:04Z
updated: 2026-11-02T00:02:00Z
---

## Description
dispatch-guard handoff-before-replace (KIT-D116) demands a 'Handoff <agent-id>' block on every ticket a past-ceiling agent ever touched, including tickets it already finished and moved to review with commits. On 2026-11-01 agent a3288d06 handed back with 13 tickets in review and one (KIT-T703, brief-grounding gate) still doing with a Handoff block in its Notes, and the guard still blocked the follow-up dispatch. Fix: only tickets still todo/doing in that agent's job list need the block, and a 'Handoff' block written by that agent (with Jobs:/State:/Next:/Files:) counts even without the id in the heading.

kit-bug-shape: cap:bug:dispatch-guard-handoff-before-replace-kit-d116-d
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-01 23:48] (created) bug — dispatch-guard handoff-before-replace (KIT-D116) demands a 'Handoff <agent-id>' block on every ticket a past-ceiling agent ever touched, inc
- [2026-11-02 00:01] (comment) @claude: Fixed in hooks/lib/agent-context.mjs: missingHandoffs only asks for a handoff on tickets with status todo or doing (a mi (full comment #1 in ## Notes)
### comment #1 [2026-11-02 00:01] @claude
Fixed in hooks/lib/agent-context.mjs: missingHandoffs only asks for a handoff on tickets with status todo or doing (a missing status counts as open); hasHandoff accepts a Handoff block whose heading names the agent or names no agent id, with the four labels anywhere in the block. Tests: agent-context.test.mjs 37 passed, successor-gate.test.mjs run.
- [2026-11-02 00:02] (status) todo → review
- [2026-11-02 00:02] (landed) 4179129 handoff-before-replace: only a todo or doing ticket needs the handoff, and a Handoff block with the four labels counts w
