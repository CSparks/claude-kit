---
id: KIT-T1309
title: broker-wait gate (wait-poll) blocks a Monitor 'until grep ... sleep' loop on target/broker/finished.log (offence 3) although KIT-D149 has th
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T09:42:47Z
updated: 2026-11-16T10:06:56Z
---

## Description
broker-wait gate (wait-poll) blocks a Monitor 'until grep ... sleep' loop on target/broker/finished.log (offence 3) although KIT-D149 has the orchestrator resume agents from finished.log with one Monitor; the tail -F | grep --line-buffered <run id> form passes but the block message does not name it

kit-bug-shape: cap:bug:broker-wait-gate-wait-poll-blocks-a-monitor-unti:a480e79d
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-16 09:42] (created) bug — broker-wait gate (wait-poll) blocks a Monitor 'until grep ... sleep' loop on target/broker/finished.log (offence 3) although KIT-D149 has th
- [2026-11-16 10:06] (status) todo → review
