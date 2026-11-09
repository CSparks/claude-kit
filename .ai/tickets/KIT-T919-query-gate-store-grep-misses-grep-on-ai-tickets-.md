---
id: KIT-T919
title: query-gate (store-grep) misses grep on .ai/tickets: this session 'grep -n -i -A25 Handoff .ai/tickets/GG-T190*.md' and 'grep -c ... .ai/tick
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: 
superseded_by: KIT-T871
created: 2026-11-09T23:06:11Z
updated: 2026-11-09T23:06:11Z
---

## Description
query-gate (store-grep) misses grep on .ai/tickets: this session 'grep -n -i -A25 Handoff .ai/tickets/GG-T190*.md' and 'grep -c ... .ai/tickets/GG-T190*.md' ran unblocked, while 'sed -n 1,40p .ai/inbox/*2026-11-09-2142*' was blocked. Same store, same glob shape; the gate should block both or the message should say which verbs and paths it allows.

kit-bug-shape: cap:bug:query-gate-store-grep-misses-grep-on-ai-tickets-
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 23:06] (created) bug — query-gate (store-grep) misses grep on .ai/tickets: this session 'grep -n -i -A25 Handoff .ai/tickets/GG-T190*.md' and 'grep -c ... .ai/tick
- [2026-11-09 23:14] (status) todo → superseded (by KIT-T871)
- [2026-11-09 23:14] (comment) @kit-agent: Duplicate of KIT-T871: the gate fix lands there (glob no longer counts as one named file; pattern searches of item files block, naming q show / q inbox / Read tool).
