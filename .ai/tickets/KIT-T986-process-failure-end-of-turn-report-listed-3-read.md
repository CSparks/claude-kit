---
id: KIT-T986
title: process failure: end-of-turn report listed 3 ready decisions (pitch-pop test, TS-era scripts, next bill) as a prose 'Decisions for you' list
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:00:06Z
updated: 2026-11-11T03:00:06Z
---

## Description
process failure: end-of-turn report listed 3 ready decisions (pitch-pop test, TS-era scripts, next bill) as a prose 'Decisions for you' list instead of an AskUserQuestion. Root cause: report template (UAT receipt + unresolved items) has no check that unresolved items needing a ruling become a questionnaire; compaction summary also carried them as 'Pending Tasks' prose. Prevention: Stop-time check that flags a final message containing 'Decisions for you' / numbered 'your call' items with no AskUserQuestion in the turn.

kit-bug-shape: cap:bug:process-failure-end-of-turn-report-listed-3-read
first seen in hustle-or-die. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-11 03:00] (created) bug — process failure: end-of-turn report listed 3 ready decisions (pitch-pop test, TS-era scripts, next bill) as a prose 'Decisions for you' list
