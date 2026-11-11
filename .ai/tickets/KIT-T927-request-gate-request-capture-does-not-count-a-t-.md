---
id: KIT-T927
title: request-gate (request-capture) does not count a 't comment <ticket>' as a capture: groovegrid 2026-11-09 Chris said 'Yeah, that's the shortc
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T808
superseded_by:
created: 2026-11-10T00:01:36Z
updated: 2026-11-10T00:06:16Z
---

## Description
request-gate (request-capture) does not count a 't comment <ticket>' as a capture: groovegrid 2026-11-09 Chris said 'Yeah, that's the shortcoming I'm concerned about. The depth of options ... needs to be fully planned out.'; the orchestrator routed it to GG-T195 as comment #23 (a legitimate route per the project contract: 'route it to the active ticket') and dispatched a planner, yet the Stop hook still reported 'Possible un-captured request'. The gate should accept a ticket comment, a decision or a dispatch citing the maintainer's words as routing.

kit-bug-shape: cap:bug:request-gate-request-capture-does-not-count-a-t-
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 00:01] (created) bug — request-gate (request-capture) does not count a 't comment <ticket>' as a capture: groovegrid 2026-11-09 Chris said 'Yeah, that's the shortc
- [2026-11-10 00:06] (status) todo → review
- [2026-11-10 00:06] (landed) cc88bde request-gate: a turn that ran cap, a t item verb (new, request, note, question, comment, criterion, decide) or dispatche
