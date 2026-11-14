---
id: KIT-T1168
title: source-shell-gate block text for a cp whose destination holds an unresolved variable prints only 'writes a source file by hand (<source>)':
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T23:39:13Z
updated: 2026-11-13T23:39:13Z
---

## Description
source-shell-gate block text for a cp whose destination holds an unresolved variable prints only 'writes a source file by hand (<source>)': it never names the variable or says to assign it as a literal NAME=value segment, or to spell the path out; the cp/mv copy path lacks the guidance the rm path has (KIT-T1156/T1162)

kit-bug-shape: cap:bug:source-shell-gate-block-text-for-a-cp-whose-dest:9dcc81e7
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-13 23:39] (created) bug — source-shell-gate block text for a cp whose destination holds an unresolved variable prints only 'writes a source file by hand (<source>)':
