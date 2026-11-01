---
id: KIT-T736
title: kit-bug-dispatch-gate counts only Agent calls as a dispatch: a SendMessage to the live standing kit agent naming the ticket id (KIT-D094 reu
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T22:10:38Z
updated: 2026-10-30T22:11:19Z
---

## Description
kit-bug-dispatch-gate counts only Agent calls as a dispatch: a SendMessage to the live standing kit agent naming the ticket id (KIT-D094 reuse) is not seen, so Stop is blocked demanding a fresh Agent call, which would put a second writer in the kit checkout. A SendMessage to a live or resumed kit agent naming the ticket id counts as dispatched.

kit-bug-shape: cap:bug:kit-bug-dispatch-gate-counts-only-agent-calls-as
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: SendMessage joins Agent/Task as a dispatch tool in the Stop gate. Evidence: hooks/kit-bug-dispatch-gate.test.mjs 12 passed (SendMessage naming the id clears; naming another id still blocks).

## History
- [2026-10-30 22:10] (created) bug — kit-bug-dispatch-gate counts only Agent calls as a dispatch: a SendMessage to the live standing kit agent naming the ticket id (KIT-D094 reu
- [2026-10-30 22:11] (status) todo → review
- [2026-10-30 22:11] (landed) 9dc81e4 kit-bug-dispatch-gate: a SendMessage to the standing kit agent naming the ticket counts as dispatched; implements KIT-T7
